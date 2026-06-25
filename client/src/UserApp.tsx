import { Switch, Route, useLocation, Redirect } from "wouter";
import { useState, useEffect, useCallback } from "react";
import { queryClient, getFullUrl, getOrRefreshAccessToken } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { SiteModeProvider } from "@/contexts/SiteModeContext";
import { UserAssetProvider } from "@/contexts/UserAssetContext";
import { getRefreshToken, setAccessToken, saveRefreshToken, clearTokens } from "@/lib/tokenManager";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import splashIcon from "@assets/user/user-mascot.png";
import userFavicon from "@assets/user/user-mascot-favicon.png";
import splashDisclaimer from "@assets/user/splash-disclaimer.webp";
import { preloadUserAssets } from "@/lib/userAssetPreloader";
import LoginPage from "@/pages/auth/login";
import SignupPage from "@/pages/auth/signup";
import ForgotPasswordPage from "@/pages/auth/forgot-password";
import GameGuidePage from "@/pages/home/game-guide";
import GoodsCategoryPage from "@/pages/home/goods-category";
import GoodsDetailPage from "@/pages/home/goods-detail";
import HomeShopPage from "@/pages/home/shop";
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
import { getPostLoginPath } from "@/lib/shopRoutes";

function getPostLoginTarget(): string {
  return getPostLoginPath("/home");
}

function AutoLoginWrapper({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const isLoginPath = window.location.pathname === "/login";
  const [isChecking, setIsChecking] = useState(isLoginPath);
  const [splashDone, setSplashDone] = useState(!isLoginPath);
  const [autoLoginSucceeded, setAutoLoginSucceeded] = useState(false);
  const { user, refetchUser } = useUser();

  useEffect(() => {
    preloadUserAssets();
  }, []);

  useEffect(() => {
    if (!isLoginPath) return;
    const timer = setTimeout(() => {
      setSplashDone(true);
    }, 7000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const checkAutoLogin = async () => {
      const currentPath = window.location.pathname;
      
      if (currentPath === "/login") {
        try {
          const token = await getOrRefreshAccessToken();
          
          if (token) {
            await refetchUser();
            setAutoLoginSucceeded(true);
            setIsChecking(false);
            return;
          }
        } catch (error) {
          console.log("Auto login failed:", error);
          await clearTokens();
        }
      }
      
      setIsChecking(false);
    };

    checkAutoLogin();
  }, [setLocation, refetchUser]);

  useEffect(() => {
    if (splashDone && !isChecking && autoLoginSucceeded && user) {
      setAutoLoginSucceeded(false);
      setLocation(getPostLoginTarget(), { replace: true });
    }
  }, [splashDone, isChecking, autoLoginSucceeded, user, setLocation]);

  useEffect(() => {
    if (user && window.location.pathname === "/login") {
      setLocation(getPostLoginPath("/home"), { replace: true });
    }
  }, [user, setLocation]);

  if (!splashDone || isChecking) {
    return (
      <div className="fixed inset-0 bg-[#111111] flex flex-col items-center justify-center px-8">
        <div className="flex flex-col items-center">
          <img 
            src={splashIcon} 
            alt="PPAMONG" 
            className="w-36 h-auto object-contain"
          />
          
          <p className="text-[#BFFF00] text-[16px] font-normal text-center leading-[1.5] mt-8">
            실시간 야구 진루 예측게임<br />PPAMONG에 오신 걸 환영합니다.
          </p>
        </div>
        
        <div className="mt-12 px-4">
          <img 
            src={splashDisclaimer} 
            alt="" 
            className="w-full max-w-[343px] mx-auto"
            style={{ transform: "scale(1.15)", transformOrigin: "center bottom" }}
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const { user, isUserLoaded } = useUser();
  const [location] = useLocation();

  if (!isUserLoaded) {
    return (
      <div className="fixed inset-0 bg-[#111111] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!user) {
    return <Redirect to={`/login?return=${encodeURIComponent(location)}`} />;
  }
  
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/social-onboarding" component={SocialOnboardingPage} />
      <Route path="/home">{() => <ProtectedRoute component={HomeShopPage} />}</Route>
      <Route path="/home/game-guide">{() => <ProtectedRoute component={GameGuidePage} />}</Route>
      <Route path="/home/shop">{() => <Redirect to="/home" />}</Route>
      <Route path="/home/goods/item/:productId">
        {() => <ProtectedRoute component={GoodsDetailPage} />}
      </Route>
      <Route path="/home/goods/:categoryId">
        {() => <ProtectedRoute component={GoodsCategoryPage} />}
      </Route>
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
      <Route path="/shop">{() => <ProtectedRoute component={HomeShopPage} />}</Route>
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
        const exitPages = ['/home', '/login'];
        
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
        <SiteModeProvider mode="user">
          <UserProvider>
            <TooltipProvider>
              <AppStateManager>
                <AutoLoginWrapper>
                  <Toaster />
                  <Router />
                </AutoLoginWrapper>
              </AppStateManager>
            </TooltipProvider>
          </UserProvider>
        </SiteModeProvider>
      </UserAssetProvider>
    </QueryClientProvider>
  );
}

export default UserApp;
