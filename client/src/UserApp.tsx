import { Switch, Route, Redirect, useLocation, useRoute } from "wouter";
import { useState, useEffect } from "react";
import { queryClient, getOrRefreshAccessToken } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { UserAssetProvider } from "@/contexts/UserAssetContext";
import { clearTokens } from "@/lib/tokenManager";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import userFavicon from "@assets/user/user-mascot-favicon.png";
import "@/styles/user-landscape.css";
import GameEmbedBootstrap from "@/components/GameEmbedBootstrap";
import GameOrientationManager from "@/components/game/GameOrientationManager";
import { preloadUserAssets } from "@/lib/userAssetPreloader";
import LoginPage from "@/pages/auth/login";
import SignupPage from "@/pages/auth/signup";
import ForgotPasswordPage from "@/pages/auth/forgot-password";
import GameGuidePage from "@/pages/home/game-guide";
import UserGuidePage from "@/pages/home/user-guide";
import UserSimulationPage from "@/pages/home/user-simulation";
import HomePage from "@/pages/home";
import PredictionPage from "@/pages/prediction";
import AttendancePage from "@/pages/attendance";
import BoardPage from "@/pages/board";
import CreatePostPage from "@/pages/create-post";
import PostDetailPage from "@/pages/post-detail";
import PointPage from "@/pages/point";
import PointHistoryPage from "@/pages/point-history";
import SettingsPage from "@/pages/setting/settings";
import ProfilePage from "@/pages/setting/profile";
import VerifyIdentityPage from "@/pages/setting/verify-identity";
import CustomerCenterPage from "@/pages/setting/customer-center";
import InquiryCreatePage from "@/pages/setting/inquiry-create";
import InquiryDetailPage from "@/pages/setting/inquiry-detail";
import NoticePage from "@/pages/setting/notice";
import NoticeDetailPage from "@/pages/setting/notice-detail";
import TermsOfServicePage from "@/pages/setting/terms-of-service";
import FaqPage from "@/pages/setting/faq";
import DonationHistoryPage from "@/pages/setting/donation-history";
import EbookPage from "@/pages/setting/ebook";
import VictoryHistoryPage from "@/pages/setting/victory-history";
import InvitePage from "@/pages/setting/invite";
import SocialOnboardingPage from "@/pages/auth/social-onboarding";
import NotFound from "@/pages/not-found";
import { completeLoginNavigation, openMallFromApp, DEFAULT_POST_LOGIN_FALLBACK } from "@/lib/appNavigation";
import { MALL_BASE_PATH } from "@shared/mallConfig";
import { peekSkipLoginBootstrap, shouldSkipLoginBootstrap } from "@/lib/loginSession";

type LoginBootstrapPhase = "checking" | "ready";

function LegacyMallRedirect({ target }: { target: string }) {
  useEffect(() => {
    window.location.replace(target);
  }, [target]);
  return null;
}

function BootstrapLoading() {
  return (
    <div className="fixed inset-0 bg-[#111111] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AutoLoginWrapper({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const isLoginPath = location.split("?")[0] === "/login";
  const skipBootstrap = isLoginPath && peekSkipLoginBootstrap(location);
  const [loginPhase, setLoginPhase] = useState<LoginBootstrapPhase>(
    isLoginPath && !skipBootstrap ? "checking" : "ready",
  );
  const { refetchUser } = useUser();

  useEffect(() => {
    preloadUserAssets();
  }, []);

  useEffect(() => {
    if (!isLoginPath) {
      setLoginPhase("ready");
      return;
    }

    if (shouldSkipLoginBootstrap(location)) {
      setLoginPhase("ready");
      return;
    }

    let cancelled = false;

    const bootstrapLogin = async () => {
      setLoginPhase("checking");

      try {
        const token = await getOrRefreshAccessToken();
        if (cancelled) return;

        if (token) {
          await refetchUser();
          if (cancelled) return;

          await completeLoginNavigation(setLocation, DEFAULT_POST_LOGIN_FALLBACK);
          setLoginPhase("ready");
          return;
        }
      } catch (error) {
        console.log("Auto login failed:", error);
        await clearTokens();
      }

      if (cancelled) return;
      setLoginPhase("ready");
    };

    void bootstrapLogin();

    return () => {
      cancelled = true;
    };
  }, [isLoginPath, location, setLocation, refetchUser]);

  if (isLoginPath && loginPhase === "checking") {
    return <BootstrapLoading />;
  }

  return <>{children}</>;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const { user, isUserLoaded } = useUser();

  if (!isUserLoaded) {
    return (
      <div className="fixed inset-0 bg-[#111111] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!user) {
    const returnPath = window.location.pathname + window.location.search;
    const params = new URLSearchParams({ return: returnPath, guest: "0" });
    return <Redirect to={`/login?${params.toString()}`} />;
  }
  
  return <Component />;
}

function RedirectLegacyProduct() {
  const [, params] = useRoute("/home/goods/item/:productId");
  const id = params?.productId ?? "";
  return <LegacyMallRedirect target={`${MALL_BASE_PATH}/product/${id}`} />;
}

function RedirectLegacyCategory() {
  const [, params] = useRoute("/home/goods/:categoryId");
  const id = params?.categoryId ?? "";
  return <LegacyMallRedirect target={`${MALL_BASE_PATH}/category/${id}`} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/social-onboarding" component={SocialOnboardingPage} />

      {/* 레거시 보물창고 상품 URL → 쇼핑몰 */}
      <Route path="/">
        {() => <Redirect to={Capacitor.isNativePlatform() ? "/login" : "/admin/"} />}
      </Route>
      <Route path="/home">{() => <ProtectedRoute component={HomePage} />}</Route>
      <Route path="/home/shop">{() => <LegacyMallRedirect target={MALL_BASE_PATH} />}</Route>
      <Route path="/home/goods/item/:productId" component={RedirectLegacyProduct} />
      <Route path="/home/goods/:categoryId" component={RedirectLegacyCategory} />

      <Route path="/home/game-guide">{() => <ProtectedRoute component={GameGuidePage} />}</Route>
      <Route path="/home/guide">{() => <ProtectedRoute component={UserGuidePage} />}</Route>
      <Route path="/home/simulation">{() => <ProtectedRoute component={UserSimulationPage} />}</Route>
      <Route path="/mall">{() => <LegacyMallRedirect target={MALL_BASE_PATH} />}</Route>

      <Route path="/prediction">{() => <ProtectedRoute component={PredictionPage} />}</Route>
      <Route path="/attendance">{() => <ProtectedRoute component={AttendancePage} />}</Route>
      <Route path="/board">{() => <ProtectedRoute component={BoardPage} />}</Route>
      <Route path="/board/create">{() => <ProtectedRoute component={CreatePostPage} />}</Route>
      <Route path="/board/:id">{() => <ProtectedRoute component={PostDetailPage} />}</Route>
      <Route path="/point">{() => <ProtectedRoute component={PointPage} />}</Route>
      <Route path="/point/history">{() => <ProtectedRoute component={PointHistoryPage} />}</Route>
      <Route path="/settings">{() => <ProtectedRoute component={SettingsPage} />}</Route>
      <Route path="/verify-identity">{() => <ProtectedRoute component={VerifyIdentityPage} />}</Route>
      <Route path="/profile">{() => <ProtectedRoute component={ProfilePage} />}</Route>
      <Route path="/customer-center">{() => <ProtectedRoute component={CustomerCenterPage} />}</Route>
      <Route path="/inquiry/create">{() => <ProtectedRoute component={InquiryCreatePage} />}</Route>
      <Route path="/inquiry/:id">{() => <ProtectedRoute component={InquiryDetailPage} />}</Route>
      <Route path="/notice">{() => <ProtectedRoute component={NoticePage} />}</Route>
      <Route path="/notice/:id">{() => <ProtectedRoute component={NoticeDetailPage} />}</Route>
      <Route path="/terms">{() => <ProtectedRoute component={TermsOfServicePage} />}</Route>
      <Route path="/faq">{() => <ProtectedRoute component={FaqPage} />}</Route>
      <Route path="/donation-history">{() => <ProtectedRoute component={DonationHistoryPage} />}</Route>
      <Route path="/ebook">{() => <ProtectedRoute component={EbookPage} />}</Route>
      <Route path="/victory-history">{() => <ProtectedRoute component={VictoryHistoryPage} />}</Route>
      <Route path="/invitation">{() => <ProtectedRoute component={InvitePage} />}</Route>
      <Route path="/mypage">{() => <ProtectedRoute component={NotFound} />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppStateManager({ children }: { children: React.ReactNode }) {
  const [, forceUpdate] = useState(0);
  
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    
    let stateHandle: any = null;
    let backHandle: any = null;
    
    const setupListeners = async () => {
      stateHandle = await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          const currentPath = window.location.pathname;
          if (currentPath === "/login" || currentPath === "/signup" || currentPath === "/forgot-password") {
            return;
          }
          forceUpdate(n => n + 1);
        }
      });

      backHandle = await App.addListener('backButton', () => {
        const path = window.location.pathname;
        const exitPages = ['/prediction', '/login'];
        
        if (exitPages.includes(path)) {
          App.minimizeApp();
        } else {
          window.history.go(-1);
        }
      });
    };
    
    setupListeners();
    
    return () => {
      if (stateHandle) {
        stateHandle.remove();
      }
      if (backHandle) {
        backHandle.remove();
      }
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

function UserApp() {
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
    iconLink.href = userFavicon;

    return () => {
      iconLink.href = previousHref;
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <UserAssetProvider>
        <UserProvider>
          <TooltipProvider>
            <AppStateManager>
              <GameOrientationManager />
              <GameEmbedBootstrap />
              <AutoLoginWrapper>
                <Toaster />
                <Router />
              </AutoLoginWrapper>
            </AppStateManager>
          </TooltipProvider>
        </UserProvider>
      </UserAssetProvider>
    </QueryClientProvider>
  );
}

export default UserApp;
export { openMallFromApp };
