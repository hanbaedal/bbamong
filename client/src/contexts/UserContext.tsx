import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from "react";
import { getFullUrl, getOrRefreshAccessToken, queryClient } from "@/lib/queryClient";
import { getAccessToken, setAccessToken, getRefreshToken, saveRefreshToken, clearTokens } from "@/lib/tokenManager";
import { sendLogoutToNative, isNativePlatform } from "@/lib/logoutPlugin";

export interface AttendanceRecord {
  id: number;
  userId: string;
  attendanceDate: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  points: number;
  lastAttendanceDate: string | null;
  attendanceRecords?: AttendanceRecord[];
  userType?: string;
  approvalStatus?: string;
  provider?: string;
  hasPassword?: boolean;
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => Promise<{ nativeHandled: boolean }>;
  isUserLoaded: boolean;
  refetchUser: () => Promise<void>;
  hasCheckedInToday: boolean;
  isGuest: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isUserLoaded, setIsUserLoaded] = useState(false);
  const isLoggedOutRef = useRef(false);
  const userRef = useRef(user);

  // 오늘 출석 여부 미리 계산 (출석 페이지 진입 전에 준비)
  const hasCheckedInToday = useMemo(() => {
    if (!user?.attendanceRecords?.length) return false;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return user.attendanceRecords.some(record => {
      const recordDate = new Date(record.attendanceDate);
      const recordStr = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}-${String(recordDate.getDate()).padStart(2, '0')}`;
      return recordStr === todayStr;
    });
  }, [user?.attendanceRecords]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // 현재 경로에 따라 올바른 API 엔드포인트 반환
  const getAuthEndpoints = () => {
    const currentPath = window.location.pathname;
    
    if (currentPath.startsWith("/admin")) {
      return {
        me: "/api/admin/me",
        refresh: "/api/admin/refresh",
        logout: "/api/admin/logout",
        loginPath: "/admin/login"
      };
    } else if (currentPath.startsWith("/manager")) {
      return {
        me: "/api/manager/me",
        refresh: "/api/manager/refresh",
        logout: "/api/manager/logout",
        loginPath: "/manager/login"
      };
    } else {
      return {
        me: "/api/users/me",
        refresh: "/api/users/refresh",
        logout: "/api/users/logout",
        loginPath: "/"
      };
    }
  };

  const fetchUser = useCallback(async () => {
    if (isLoggedOutRef.current) {
      setIsUserLoaded(true);
      return;
    }

    const endpoints = getAuthEndpoints();
    const currentPath = window.location.pathname;
    const isUserApp = !currentPath.startsWith("/admin") && !currentPath.startsWith("/manager");

    if (isUserApp) {
      const token = getAccessToken();
      const refreshToken = await getRefreshToken();
      if (!token && !refreshToken) {
        setUser(null);
        setIsUserLoaded(true);
        return;
      }
    }
    
    // User App: Bearer Token, Admin/Manager: Cookie
    const getHeaders = (): Record<string, string> => {
      if (isUserApp) {
        const token = getAccessToken();
        if (token) {
          return {
            'Authorization': `Bearer ${token}`,
          };
        }
      }
      return {};
    };

    const makeRequest = async () => {
      return fetch(getFullUrl(endpoints.me), {
        headers: getHeaders(),
        credentials: isUserApp ? "omit" : "include", // User App: 토큰, Admin/Manager: 쿠키
      });
    };

    try {
      let response = await makeRequest();

      if (response.status === 401) {
        if (isUserApp) {
          const token = await getOrRefreshAccessToken();
          if (!token) {
            console.log("[UserContext] Token refresh failed");
            if (!userRef.current) {
              setUser(null);
            } else {
              console.log("[UserContext] Keeping existing user state despite refresh failure");
            }
            setIsUserLoaded(true);
            return;
          }
          response = await makeRequest();
        } else {
          const refreshResponse = await fetch(getFullUrl(endpoints.refresh), {
            method: "POST",
            credentials: "include",
          });

          if (refreshResponse.ok) {
            response = await makeRequest();
          } else {
            console.log("Refresh token expired or missing, redirecting to login");
            setUser(null);
            setIsUserLoaded(true);
            window.location.href = endpoints.loginPath;
            return;
          }
        }
      }

      if (response.ok) {
        const data = await response.json();
        isLoggedOutRef.current = false;
        // 일반 유저는 success: true, user: {...}, attendanceRecords: [...]
        // 매니저/관리자는 {...} 직접 반환
        if (data.user) {
          // 일반 유저 응답
          setUser({
            ...data.user,
            attendanceRecords: data.attendanceRecords || [],
          });
        } else {
          // 매니저/관리자 응답
          setUser({
            ...data,
            attendanceRecords: [],
          });
        }
      } else if (response.status === 403) {
        setUser(null);
      } else if (!userRef.current) {
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
      if (!userRef.current) {
        setUser(null);
      }
    } finally {
      setIsUserLoaded(true);
    }
  }, []);

  useEffect(() => {
    // Public 페이지에서는 fetchUser 호출 안 함
    const publicPaths = [
      // 일반 유저
      "/",
      "/login",
      "/signup",
      "/social-onboarding",
      "/forgot-password",
      // 어드민
      "/admin/login",
      "/admin/signup",
      "/admin/waiting",
      // 매니저
      "/manager/login",
      "/manager/signup",
      "/manager/pending-approval"
    ];
    const currentPath = window.location.pathname;
    
    if (!publicPaths.includes(currentPath)) {
      // 인증이 필요한 페이지에서만 사용자 정보 조회
      fetchUser();
    } else {
      // Public 페이지에서는 로딩만 완료 처리
      setIsUserLoaded(true);
    }
  }, []);

  const handleSetUser = useCallback((newUser: User | null) => {
    if (newUser) {
      isLoggedOutRef.current = false;
    }
    setUser(newUser);
  }, []);

  const logout = async (): Promise<{ nativeHandled: boolean }> => {
    isLoggedOutRef.current = true;
    
    const endpoints = getAuthEndpoints();
    const currentPath = window.location.pathname;
    const isUserApp = !currentPath.startsWith("/admin") && !currentPath.startsWith("/manager");
    
    // 네이티브 앱(WebView)에서는 네이티브에게 로그아웃 신호만 전송
    // 실제 로그아웃 처리(API 호출, 토큰 삭제, 화면 전환)는 네이티브에서 수행
    if (isUserApp && isNativePlatform()) {
      console.log("[Logout] Native platform detected - sending logout signal to native");
      const logoutApiUrl = getFullUrl(endpoints.logout);
      const loginUrl = window.location.origin + endpoints.loginPath;
      const nativeHandled = await sendLogoutToNative(logoutApiUrl, loginUrl);
      if (nativeHandled) {
        // 네이티브에서 모든 처리를 담당 (API 호출, 토큰 삭제, WebView 리로드)
        // 웹에서는 React 상태만 초기화하고 네비게이션은 하지 않음
        setUser(null);
        return { nativeHandled: true };
      }
      // 네이티브 처리 실패 시 웹에서 fallback 처리
      console.log("[Logout] Native logout failed, falling back to web logout");
    }
    
    // 웹 브라우저에서의 로그아웃 처리 (또는 네이티브 fallback)
    try {
      if (isUserApp) {
        // User App: Bearer Token 방식
        const token = getAccessToken();
        if (token) {
          await fetch(getFullUrl(endpoints.logout), {
            method: "POST",
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
        }
      } else {
        // Admin/Manager: Cookie 방식
        await fetch(getFullUrl(endpoints.logout), {
          method: "POST",
          credentials: "include",
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // API 호출 성공/실패 여부와 관계없이 항상 로컬 상태 정리
      if (isUserApp) {
        await clearTokens();
      }
      queryClient.clear();
      setUser(null);
    }
    return { nativeHandled: false };
  };

  const isGuest = useMemo(() => user?.provider === "guest", [user?.provider]);

  return (
    <UserContext.Provider value={{ user, setUser: handleSetUser, logout, isUserLoaded, refetchUser: fetchUser, hasCheckedInToday, isGuest }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
