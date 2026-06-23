import { Switch, Route, Redirect } from "wouter";
import NotFound from "./pages/not-found";
import { Toaster } from "@/components/ui/toaster";

// Auth Pages
import AdminLoginPage from "@/adminPages/auth/login";
import AdminHomePage from "@/adminPages/AdminHome";
import HomePageManagementPage from "@/adminPages/HomePageManagement";
import AdminSignupPage from "@/adminPages/auth/signup";
import AdminWaitingPage from "@/adminPages/auth/waiting";

// Member Pages
import MemberListPage from "@/adminPages/members/MemberList";
import DonationRankingsPage from "@/adminPages/members/DonationRankings";
import VictoryRankingPage from "@/adminPages/members/VictoryRanking";
import PointsRankingPage from "@/adminPages/members/PointsRanking";
// Admin Management Pages
import StaffListPage from "@/adminPages/admins/StaffList";
import StaffRegisterPage from "@/adminPages/admins/StaffRegister";
import ManagerListPage from "@/adminPages/admins/ManagerList";
import OperatorRegisterPage from "@/adminPages/admins/OperatorRegister";
import InviteManagementPage from "@/adminPages/members/InviteManagement";
import MonitoringPage from "@/adminPages/admins/OperatorMonitoring";
import MatchManagementPage from "@/adminPages/admins/MatchManagement";
import RealtimeGameMonitoringPage from "@/adminPages/admins/RealtimeGameMonitoring";
// Revenue Pages
import BannerRevenuePage from "@/adminPages/revenue/BannerRevenue";
import VideosPage from "@/adminPages/Videos";
import WaitingScreenManagementPage from "@/adminPages/revenue/WaitingScreenManagement";
import AdvertisementManagementPage from "@/adminPages/revenue/AdvertisementManagement";

import customerSupport from "@/adminPages/CustomerSupport";

// Other Admin Pages
import NoticesPage from "@/adminPages/Notices";
import TermsManagementPage from "@/adminPages/TermsManagement";
import DbBackupPage from "@/adminPages/ops/DbBackup";
import AdminLoginStatusPage from "@/adminPages/ops/AdminLoginStatus";
import ManagerLoginStatusPage from "@/adminPages/ops/ManagerLoginStatus";
import HomeShopPage from "@/pages/home/shop";
import { adminQueryClient } from "./lib/adminQueryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { AdminAssetProvider } from "@/contexts/AdminAssetContext";
import { UserAssetProvider } from "@/contexts/UserAssetContext";
import { SiteModeProvider } from "@/contexts/SiteModeContext";
import { SessionExpiredPopup } from "@/components/SessionExpiredPopup";
import { UserProvider } from "./contexts/UserContext";
import { useEffect } from "react";
import adminFavicon from "@assets/admin/admin-mascot-favicon.png";

function AdminHomepageShopPage() {
  return (
    <SiteModeProvider mode="admin">
      <UserAssetProvider>
        <HomeShopPage />
      </UserAssetProvider>
    </SiteModeProvider>
  );
}

function Router() {
  return (
    <Switch>
      {/* 관리자 로그인: /admin/login (루트 / 는 공개 홈페이지 PublicApp) */}
      <Route path="/admin/login" component={AdminLoginPage} />
      <Route path="/admin/signup" component={AdminSignupPage} />
      <Route path="/admin/waiting" component={AdminWaitingPage} />
      <Route path="/admin/home" component={AdminHomePage} />
      <Route path="/admin/homepage-shop" component={AdminHomepageShopPage} />
      <Route path="/admin/homepage-management" component={HomePageManagementPage} />

      {/* 회원 관리 */}
      <Route path="/admin/members/list" component={MemberListPage} />
      <Route
        path="/admin/members/donation-rankings"
        component={DonationRankingsPage}
      />
      <Route path="/admin/members/invite" component={InviteManagementPage} />
      <Route
        path="/admin/members/victory-ranking"
        component={VictoryRankingPage}
      />
      <Route
        path="/admin/members/points-ranking"
        component={PointsRankingPage}
      />

      {/* 관리자 관리 (슈퍼바이저) */}
      <Route path="/admin/staff">{() => <Redirect to="/admin/staff/list" />}</Route>
      <Route path="/admin/staff/list" component={StaffListPage} />
      <Route path="/admin/staff/register" component={StaffRegisterPage} />
      <Route path="/admin/managers">{() => <Redirect to="/admin/operators/list" />}</Route>
      <Route path="/admin/operators/list" component={ManagerListPage} />
      <Route path="/admin/operators/register" component={OperatorRegisterPage} />
      <Route path="/admin/match-assignment">{() => <Redirect to="/admin/operators/list" />}</Route>
      <Route path="/admin/monitoring" component={MonitoringPage} />
      <Route path="/admin/match-management" component={MatchManagementPage} />
      <Route
        path="/admin/match-monitoring/:dateKey"
        component={RealtimeGameMonitoringPage}
      />

      {/* 수익 관리 */}
      <Route path="/admin/revenue/banner" component={BannerRevenuePage} />
      <Route path="/admin/revenue/video" component={VideosPage} />
      <Route
        path="/admin/revenue/video-ad-manage"
        component={AdvertisementManagementPage}
      />
      <Route
        path="/admin/revenue/waiting-screen"
        component={WaitingScreenManagementPage}
      />

      {/* 기타 페이지 */}
      <Route path="/admin/notices" component={NoticesPage} />
      <Route path="/admin/terms" component={TermsManagementPage} />
      <Route path="/admin/ops/db-backup" component={DbBackupPage} />
      <Route path="/admin/ops/admin-login-status" component={AdminLoginStatusPage} />
      <Route path="/admin/ops/manager-login-status" component={ManagerLoginStatusPage} />

      <Route path="/admin/support" component={customerSupport} />

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

export default function AdminApp() {
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
    iconLink.href = adminFavicon;

    return () => {
      iconLink.href = previousHref;
    };
  }, []);

  return (
    <QueryClientProvider client={adminQueryClient}>
      <AdminAssetProvider>
        <UserProvider>
          <Router />
        </UserProvider>
        <SessionExpiredPopup />
        <Toaster />
      </AdminAssetProvider>
    </QueryClientProvider>
  );
}
