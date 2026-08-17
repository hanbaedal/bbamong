import { Component, ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { managerQueryClient, getFullUrl } from "./lib/managerQueryClient";
import { ManagerAssetProvider } from "./contexts/ManagerAssetContext";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { useState, useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

class ManagerErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ManagerApp] Uncaught error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-white flex flex-col items-center justify-center px-8">
          <p className="text-gray-700 text-base font-medium text-center mb-4">
            오류가 발생했습니다. 앱을 다시 시작해 주세요.
          </p>
          <button
            className="px-6 py-3 bg-[#1A6DFF] text-white rounded-lg font-semibold text-sm"
            onClick={() => {
              this.setState({ hasError: false });
              window.location.replace("/manager/login");
            }}
          >
            로그인 화면으로 이동
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import { getManagerRefreshToken, setManagerAccessToken, saveManagerRefreshToken, getManagerAccessToken } from "./lib/managerTokenManager";
import { installAudioUnlockListeners } from "./lib/mobileAudioUnlock";
import MatchResultTest from "./pages/manager/MatchResultTest";
import ManagerLoginPage from "./managerPages/auth/login";
import ManagerSignupPage from "./managerPages/auth/signup";
import ManagerPendingApprovalPage from "./managerPages/auth/pending-approval";
import ManagerHomePage from "./managerPages/home";
import MatchDetailPage from "./managerPages/matchDetail";
import ManagerGuidePage from "./managerPages/guide";
import ManagerSimulationPage from "./managerPages/simulation";
import NotFound from "./pages/not-found";
import { SessionExpiredPopup } from "./components/SessionExpiredPopup";
import splashIcon from "@assets/manager/manager-mascot.png";
import managerFavicon from "@assets/manager/manager-mascot-favicon.png";

function AppStateManager({ children }: { children: React.ReactNode }) {
  const [, forceUpdate] = useState(0);
  
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    
    let stateHandle: any = null;
    let backHandle: any = null;
    
    const setupListeners = async () => {
      stateHandle = await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          forceUpdate(n => n + 1);
        }
      });

      backHandle = await App.addListener('backButton', () => {
        const path = window.location.pathname;
        // 경기 운영 화면 — 실수 종료 방지: 시스템 BACK 무시 (게임 /prediction 과 동일)
        if (path.startsWith('/manager/match/')) {
          return;
        }
        if (path === '/manager/guide' || path === '/manager/simulation' || path === '/manager/test') {
          window.location.replace('/manager/home');
        } else if (path === '/manager/signup' || path === '/manager/pending-approval') {
          window.location.replace('/manager/login');
        } else {
          App.minimizeApp();
        }
      });
    };
    
    setupListeners();
    
    return () => {
      if (stateHandle) stateHandle.remove();
      if (backHandle) backHandle.remove();
    };
  }, []);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'ios') return;

    const handleFocusIn = () => {
      setTimeout(() => {
        const el = document.activeElement as HTMLElement | null;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    };

    const handleFocusOut = () => {
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      }, 100);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);
  
  return <>{children}</>;
}

function extractManagerLoginToken(rawUrl: string): string | null {
  try {
    const normalized = rawUrl.includes("://")
      ? rawUrl
      : `https://dummy${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
    const url = new URL(normalized);
    const t = url.searchParams.get("t");
    return t?.trim() || null;
  } catch {
    return null;
  }
}

function ManagerLoginLinkListener() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listenerHandle: { remove: () => void } | null = null;

    const openLoginWithToken = (rawUrl: string) => {
      const token = extractManagerLoginToken(rawUrl);
      if (!token) return;
      setLocation(`/manager/login?t=${encodeURIComponent(token)}`, { replace: true });
    };

    const setup = async () => {
      try {
        const launch = await App.getLaunchUrl();
        if (launch?.url) openLoginWithToken(launch.url);
      } catch {
        /* no launch url */
      }
      listenerHandle = await App.addListener("appUrlOpen", (event) => {
        openLoginWithToken(event.url);
      });
    };

    void setup();
    return () => {
      listenerHandle?.remove();
    };
  }, [setLocation]);

  return null;
}

function isManagerPublicPath(path: string): boolean {
  return (
    path === "/manager/login" ||
    path === "/manager/signup" ||
    path === "/manager/pending-approval"
  );
}

function AutoLoginWrapper({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    const checkAutoLogin = async () => {
      try {
        const currentPath = window.location.pathname;
        let loginToken = new URLSearchParams(window.location.search).get("t");

        // 네이티브 cold start 딥링크에 토큰이 있으면 우선 처리
        if (!loginToken && isNative) {
          try {
            const launch = await App.getLaunchUrl();
            if (launch?.url) {
              loginToken = extractManagerLoginToken(launch.url);
            }
          } catch {
            /* ignore */
          }
        }

        if (loginToken?.trim()) {
          setIsChecking(false);
          setLocation(`/manager/login?t=${encodeURIComponent(loginToken.trim())}`, {
            replace: true,
          });
          return;
        }

        if (isNative) {
          const savedRefreshToken = await getManagerRefreshToken();
          if (savedRefreshToken) {
            try {
              const refreshRes = await fetch(getFullUrl("/api/manager/refresh"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken: savedRefreshToken }),
              });

              if (refreshRes.ok) {
                const data = await refreshRes.json();
                if (data.accessToken && data.refreshToken) {
                  setManagerAccessToken(data.accessToken);
                  await saveManagerRefreshToken(data.refreshToken);
                }
              }
            } catch (error) {
              console.log("Token refresh failed:", error);
            }
          }
        }

        const accessToken = isNative ? getManagerAccessToken() : null;
        const headers: HeadersInit = isNative && accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
        let manager: { approvalStatus?: string } | null = null;

        try {
          const res = await fetch(getFullUrl("/api/manager/me"), {
            headers,
            credentials: isNative ? "omit" : "include",
          });
          if (res.ok) {
            const data = await res.json();
            manager = data.manager ?? null;
          }
        } catch (error) {
          console.log("Auto login check failed:", error);
        }

        if (manager) {
          if (manager.approvalStatus === "승인") {
            setIsChecking(false);
            if (isManagerPublicPath(currentPath) || currentPath === "/manager" || currentPath === "/manager/") {
              setLocation("/manager/home", { replace: true });
            }
            return;
          }
          setIsChecking(false);
          if (currentPath !== "/manager/pending-approval") {
            setLocation("/manager/pending-approval", { replace: true });
          }
          return;
        }

        setIsChecking(false);
        if (!isManagerPublicPath(currentPath)) {
          setLocation("/manager/login", { replace: true });
        }
      } catch (error) {
        console.error("checkAutoLogin unexpected error:", error);
        setIsChecking(false);
        setLocation("/manager/login", { replace: true });
      }
    };

    checkAutoLogin();
  }, [setLocation, isNative]);

  if (isChecking) {
    return (
      <div className="fixed inset-0 bg-[#111111] flex flex-col items-center justify-center px-8">
        <img src={splashIcon} alt="PPAMONG 운영자" className="w-28 h-auto mb-4 object-contain" />
        <p className="text-[#E9E9E9] text-lg font-semibold">운영자 앱 로딩 중...</p>
      </div>
    );
  }

  return (
    <>
      <ManagerLoginLinkListener />
      {children}
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/">{() => <Redirect to="/manager/login" />}</Route>
      <Route path="/manager">{() => <Redirect to="/manager/login" />}</Route>
      <Route path="/manager/login" component={ManagerLoginPage} />
      <Route path="/manager/signup" component={ManagerSignupPage} />
      <Route path="/manager/pending-approval" component={ManagerPendingApprovalPage} />
      <Route path="/manager/home" component={ManagerHomePage} />
      <Route path="/manager/guide" component={ManagerGuidePage} />
      <Route path="/manager/simulation" component={ManagerSimulationPage} />
      <Route path="/manager/match/:id" component={MatchDetailPage} />
      <Route path="/manager/test" component={MatchResultTest} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function ManagerApp() {
  useEffect(() => {
    return installAudioUnlockListeners();
  }, []);

  useEffect(() => {
    const iconLink =
      document.querySelector<HTMLLinkElement>("link[rel='icon']") ??
      (() => {
        const link = document.createElement("link");
        link.rel = "icon";
        link.type = "image/png";
        document.head.appendChild(link);
        return link;
      })();

    const previousHref = iconLink.href;
    iconLink.href = managerFavicon;

    return () => {
      iconLink.href = previousHref;
    };
  }, []);

  return (
    <ManagerErrorBoundary>
      <QueryClientProvider client={managerQueryClient}>
        <ManagerAssetProvider>
          <TooltipProvider>
            <AppStateManager>
              <AutoLoginWrapper>
                <Toaster />
                <SessionExpiredPopup />
                <Router />
              </AutoLoginWrapper>
            </AppStateManager>
          </TooltipProvider>
        </ManagerAssetProvider>
      </QueryClientProvider>
    </ManagerErrorBoundary>
  );
}
