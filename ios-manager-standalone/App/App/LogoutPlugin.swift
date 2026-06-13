import Foundation
import Capacitor
import WebKit

@objc(LogoutPlugin)
public class LogoutPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LogoutPlugin"
    public let jsName = "LogoutPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "performLogout", returnType: CAPPluginReturnPromise)
    ]
    
    @objc func performLogout(_ call: CAPPluginCall) {
        let logoutApiUrl = call.getString("logoutApiUrl") ?? ""
        let loginUrl = call.getString("loginUrl") ?? ""
        
        print("[LogoutPlugin] Received logout request - API: \(logoutApiUrl), Login URL: \(loginUrl)")
        
        // loginUrl이 없으면 실패 처리
        guard !loginUrl.isEmpty else {
            print("[LogoutPlugin] Error: Login URL is required")
            call.reject("Login URL is required")
            return
        }
        
        // 비동기로 로그아웃 처리
        DispatchQueue.global(qos: .userInitiated).async {
            var apiSuccess = true
            
            // 1. 서버 로그아웃 API 호출
            apiSuccess = self.callLogoutApi(logoutApiUrl: logoutApiUrl)
            
            // 메인 스레드에서 나머지 작업 수행
            DispatchQueue.main.async {
                var cleanupSuccess = true
                
                do {
                    // 2. 토큰 삭제 (Capacitor Preferences)
                    self.clearCapacitorPreferences()
                    
                    // 3. 쿠키 삭제
                    self.clearCookies()
                    
                    // 4. WebView 스토리지 삭제 및 리로드
                    self.clearWebStorageAndReload(loginUrl: loginUrl) { success in
                        if success {
                            call.resolve()
                        } else {
                            call.reject("Failed to reload WebView")
                        }
                    }
                } catch {
                    print("[LogoutPlugin] Cleanup error: \(error.localizedDescription)")
                    call.reject("Cleanup failed: \(error.localizedDescription)")
                }
            }
        }
    }
    
    private func callLogoutApi(logoutApiUrl: String) -> Bool {
        guard !logoutApiUrl.isEmpty, let url = URL(string: logoutApiUrl) else {
            print("[LogoutPlugin] No logout API URL provided, skipping")
            return true // API URL 없으면 스킵하고 성공 처리
        }
        
        // Capacitor Preferences에서 토큰 가져오기
        let accessToken = UserDefaults(suiteName: "CapacitorStorage")?.string(forKey: "userAccessToken") ?? ""
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 10
        
        if !accessToken.isEmpty {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }
        
        let semaphore = DispatchSemaphore(value: 0)
        var success = false
        
        URLSession.shared.dataTask(with: request) { _, response, error in
            if let httpResponse = response as? HTTPURLResponse {
                print("[LogoutPlugin] Logout API response: \(httpResponse.statusCode)")
                success = (200..<300).contains(httpResponse.statusCode)
            }
            if let error = error {
                print("[LogoutPlugin] Logout API error: \(error.localizedDescription)")
                success = false
            }
            semaphore.signal()
        }.resume()
        
        _ = semaphore.wait(timeout: .now() + 10)
        return success
    }
    
    private func clearCapacitorPreferences() {
        if let userDefaults = UserDefaults(suiteName: "CapacitorStorage") {
            userDefaults.removeObject(forKey: "userAccessToken")
            userDefaults.removeObject(forKey: "userRefreshToken")
            userDefaults.synchronize()
            print("[LogoutPlugin] Cleared Capacitor Preferences tokens")
        }
    }
    
    private func clearCookies() {
        // HTTPCookieStorage 쿠키 삭제
        if let cookies = HTTPCookieStorage.shared.cookies {
            for cookie in cookies {
                HTTPCookieStorage.shared.deleteCookie(cookie)
            }
        }
        
        // WKWebView 쿠키 삭제
        WKWebsiteDataStore.default().httpCookieStore.getAllCookies { cookies in
            for cookie in cookies {
                WKWebsiteDataStore.default().httpCookieStore.delete(cookie)
            }
        }
        print("[LogoutPlugin] Cleared cookies")
    }
    
    private func clearWebStorageAndReload(loginUrl: String, completion: @escaping (Bool) -> Void) {
        let dataTypes = Set([
            WKWebsiteDataTypeCookies,
            WKWebsiteDataTypeLocalStorage,
            WKWebsiteDataTypeSessionStorage,
            WKWebsiteDataTypeIndexedDBDatabases,
            WKWebsiteDataTypeWebSQLDatabases
        ])
        
        let dateFrom = Date(timeIntervalSince1970: 0)
        WKWebsiteDataStore.default().removeData(ofTypes: dataTypes, modifiedSince: dateFrom) { [weak self] in
            print("[LogoutPlugin] Cleared WebView storage")
            
            // WebView를 로그인 URL로 리로드
            guard let url = URL(string: loginUrl) else {
                print("[LogoutPlugin] Invalid login URL")
                completion(false)
                return
            }
            
            if let webView = self?.bridge?.webView {
                webView.load(URLRequest(url: url))
                print("[LogoutPlugin] WebView reloaded to: \(loginUrl)")
                completion(true)
            } else {
                print("[LogoutPlugin] WebView not available")
                completion(false)
            }
        }
    }
}
