import { Switch, Route, Redirect, useRoute } from "wouter";
import { useState, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { UserAssetProvider } from "@/contexts/UserAssetContext";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import userFavicon from "@assets/user/user-mascot-favicon.png";
import "@/styles/user-landscape.css";
import "@/styles/landscape-split.css";
import GameEmbedBootstrap from "@/components/GameEmbedBootstrap";
import GameEmbedAuthBridge from "@/components/GameEmbedAuthBridge";
import GameOrientationManager from "@/components/game/GameOrientationManager";
import { preloadUserAssets } from "@/lib/userAssetPreloader";
import LoginPage from "@/pages/auth/login";
import SignupPage from "@/pages/auth/signup";
import ForgotPasswordPage from "@/pages/auth/forgot-password";
import GameGuidePage from "@/pages/home/game-guide";
import UserGuidePage from "@/pages/home/user-guide";
import UserSimulationPage from "@/pages/home/user-simulation";
import FriendRoomsPage, { FriendRoomJoinPage } from "@/pages/home/rooms";
import HomePage from "@/pages/home";
import PredictionPage from "@/pages/prediction";
import SocialOnboardingPage from "@/pages/auth/social-onboarding";
import NotFound from "@/pages/not-found";
import HomeNoticeSplitPage from "@/pages/landscape/HomeNoticeSplitPage";
import HomeInquirySplitPage from "@/pages/landscape/HomeInquirySplitPage";
import HomeBoardSplitPage from "@/pages/landscape/HomeBoardSplitPage";
import GameStorySplitPage from "@/pages/landscape/GameStorySplitPage";
import GameInfoSplitPage from "@/pages/landscape/GameInfoSplitPage";
import UserSessionExpiredPopup from "@/components/UserSessionExpiredPopup";
import UserLoginAttemptNotice from "@/components/UserLoginAttemptNotice";
import { openMallFromApp, GAME_PATH, HOME_PATH } from "@/lib/appNavigation";
import { MALL_BASE_PATH } from "@shared/mallConfig";
import { installAudioUnlockListeners } from "@/lib/mobileAudioUnlock";

function LegacyMallRedirect({ target }: { target: string }) {
  useEffect(() => {
    window.location.replace(target);
  }, [target]);
  return null;
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

      {/* 가로 split — 구체 경로를 /home 보다 먼저 등록 */}
      <Route path="/home/board/new">{() => <ProtectedRoute component={HomeBoardSplitPage} />}</Route>
      <Route path="/home/board/:id">{() => <ProtectedRoute component={HomeBoardSplitPage} />}</Route>
      <Route path="/home/board">{() => <ProtectedRoute component={HomeBoardSplitPage} />}</Route>

      <Route path="/home/inquiry/new">{() => <ProtectedRoute component={HomeInquirySplitPage} />}</Route>
      <Route path="/home/inquiry/:id">{() => <ProtectedRoute component={HomeInquirySplitPage} />}</Route>
      <Route path="/home/inquiry">{() => <ProtectedRoute component={HomeInquirySplitPage} />}</Route>

      <Route path="/home/notice/:id">{() => <ProtectedRoute component={HomeNoticeSplitPage} />}</Route>
      <Route path="/home/notice">{() => <ProtectedRoute component={HomeNoticeSplitPage} />}</Route>

      <Route path="/home/shop">{() => <LegacyMallRedirect target={MALL_BASE_PATH} />}</Route>
      <Route path="/home/goods/item/:productId" component={RedirectLegacyProduct} />
      <Route path="/home/goods/:categoryId" component={RedirectLegacyCategory} />
      <Route path="/home/game-guide">{() => <ProtectedRoute component={GameGuidePage} />}</Route>
      <Route path="/home/guide">{() => <ProtectedRoute component={UserGuidePage} />}</Route>
      <Route path="/home/simulation">{() => <ProtectedRoute component={UserSimulationPage} />}</Route>
      <Route path="/home/rooms">{() => <ProtectedRoute component={FriendRoomsPage} />}</Route>
      <Route path="/rooms/join/:token">{() => <ProtectedRoute component={FriendRoomJoinPage} />}</Route>
      <Route path="/home">{() => <ProtectedRoute component={HomePage} />}</Route>

      <Route path="/game/story/:section">{() => <ProtectedRoute component={GameStorySplitPage} />}</Route>
      <Route path="/game/story">{() => <Redirect to="/game/story/victory" />}</Route>
      <Route path="/game/info/:section">{() => <ProtectedRoute component={GameInfoSplitPage} />}</Route>
      <Route path="/game/info">{() => <Redirect to="/game/info/profile" />}</Route>

      {/* 레거시 URL → split (북마크·옛 링크) */}
      <Route path="/notice/:id">{(params) => <Redirect to={`/home/notice/${params.id}`} />}</Route>
      <Route path="/notice">{() => <Redirect to="/home/notice" />}</Route>
      <Route path="/inquiry/create">{() => <Redirect to="/home/inquiry/new" />}</Route>
      <Route path="/inquiry/:id">{(params) => <Redirect to={`/home/inquiry/${params.id}`} />}</Route>
      <Route path="/customer-center">{() => <Redirect to="/home/inquiry" />}</Route>
      <Route path="/board/create">{() => <Redirect to="/home/board/new" />}</Route>
      <Route path="/board/:id">{(params) => <Redirect to={`/home/board/${params.id}`} />}</Route>
      <Route path="/board">{() => <Redirect to="/home/board" />}</Route>
      <Route path="/victory-history">{() => <Redirect to="/game/story/victory" />}</Route>
      <Route path="/invitation">{() => <Redirect to="/game/story/invite" />}</Route>
      <Route path="/attendance">{() => <Redirect to="/game/story/attendance" />}</Route>
      <Route path="/ebook">{() => <Redirect to="/game/story/ebook" />}</Route>
      <Route path="/donation-history">{() => <Redirect to="/game/story/donation" />}</Route>
      <Route path="/verify-identity">{() => <Redirect to="/game/info/profile" />}</Route>
      <Route path="/profile">{() => <Redirect to="/game/info/profile-edit" />}</Route>
      <Route path="/point">{() => <Redirect to="/game/info/point" />}</Route>
      <Route path="/faq">{() => <Redirect to="/game/info/faq" />}</Route>
      <Route path="/terms">{() => <Redirect to="/game/info/terms" />}</Route>

      <Route path="/mall">{() => <LegacyMallRedirect target={MALL_BASE_PATH} />}</Route>

      <Route path="/prediction">{() => <ProtectedRoute component={PredictionPage} />}</Route>
      <Route path="/point/history">{() => <Redirect to="/game/info/point" />}</Route>
      <Route path="/settings">{() => <Redirect to="/home" />}</Route>
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

        // 예측게임·홈 — 실수 종료 방지: 시스템 BACK 무시 (홈은 앱 내 이동으로만 이탈)
        if (path === GAME_PATH || path === HOME_PATH) {
          return;
        }

        if (path === '/login') {
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
    preloadUserAssets();
  }, []);

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
              <GameEmbedAuthBridge />
              <GameEmbedBootstrap />
              <Toaster />
              <UserSessionExpiredPopup />
              <UserLoginAttemptNotice />
              <Router />
            </AppStateManager>
          </TooltipProvider>
        </UserProvider>
      </UserAssetProvider>
    </QueryClientProvider>
  );
}

export default UserApp;
export { openMallFromApp };
