import { Switch, Route, Redirect } from "wouter";
import NotFound from "./pages/not-found";
import { Toaster } from "@/components/ui/toaster";

// Auth Pages
import AdminLoginPage from "@/adminPages/auth/login";
import AdminHomePage from "@/adminPages/AdminHome";
import HomePageManagementPage from "@/adminPages/HomePageManagement";
import AppHomeSettingsPage from "@/adminPages/AppHomeSettings";
import KboRosterPage from "@/adminPages/KboRoster";
import MallOrderManagementPage from "@/adminPages/MallOrderManagement";
import MallSalesManagementPage from "@/adminPages/MallSalesManagement";
import MallInventoryManagementPage from "@/adminPages/MallInventoryManagement";
import MallPurchaseManagementPage from "@/adminPages/MallPurchaseManagement";
import { AdminProtectedLayout } from "@/adminPages/components/AdminProtectedLayout";
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
import BoardManagementPage from "@/adminPages/BoardManagement";

// Other Admin Pages
import NoticesPage from "@/adminPages/Notices";
import TermsManagementPage from "@/adminPages/TermsManagement";
import DbBackupPage from "@/adminPages/ops/DbBackup";
import SystemManualsPage from "@/adminPages/ops/SystemManuals";
import AppReleaseManagementPage from "@/adminPages/ops/AppReleaseManagement";
import AdminLoginStatusPage from "@/adminPages/ops/AdminLoginStatus";
import ManagerLoginStatusPage from "@/adminPages/ops/ManagerLoginStatus";
import AdminMallPreviewPage from "@/adminPages/AdminMallPreview";
import { adminQueryClient } from "./lib/adminQueryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { AdminAssetProvider } from "@/contexts/AdminAssetContext";
import { SessionExpiredPopup } from "@/components/SessionExpiredPopup";
import { UserProvider } from "./contexts/UserContext";
import { useEffect } from "react";
import adminFavicon from "@assets/admin/admin-mascot-favicon.png";

function adminKstTodayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function Router() {
  return (
    <Switch>
      {/* 관리자 로그인: /admin/login — 슈퍼어드민·일반어드민만 */}
      <Route path="/admin">{() => <Redirect to="/admin/login" />}</Route>
      <Route path="/admin/login" component={AdminLoginPage} />
      <Route path="/admin/signup" component={AdminSignupPage} />
      <Route path="/admin/waiting" component={AdminWaitingPage} />
      <Route path="/admin/home" component={AdminHomePage} />
      <Route path="/admin/mall-preview" component={AdminMallPreviewPage} />
      <Route path="/admin/mall-management" component={HomePageManagementPage} />
      <Route path="/admin/app-home-settings" component={AppHomeSettingsPage} />
      <Route path="/admin/kbo-roster" component={KboRosterPage} />
      <Route path="/admin/mall-orders" component={MallOrderManagementPage} />
      <Route path="/admin/mall-sales" component={MallSalesManagementPage} />
      <Route path="/admin/mall-inventory" component={MallInventoryManagementPage} />
      <Route path="/admin/mall-purchase" component={MallPurchaseManagementPage} />
      <Route path="/admin/homepage-shop">{() => <Redirect to="/admin/mall-preview" />}</Route>
      <Route path="/admin/homepage-management">{() => <Redirect to="/admin/mall-management" />}</Route>

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
      <Route path="/admin/match-monitoring">
        {() => (
          <Redirect to={`/admin/match-monitoring/${adminKstTodayKey()}?matchIndex=0`} />
        )}
      </Route>
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
      <Route path="/admin/ops/app-releases" component={AppReleaseManagementPage} />
      <Route path="/admin/ops/system-manuals" component={SystemManualsPage} />
      <Route path="/admin/ops/db-backup" component={DbBackupPage} />
      <Route path="/admin/ops/admin-login-status" component={AdminLoginStatusPage} />
      <Route path="/admin/ops/manager-login-status" component={ManagerLoginStatusPage} />

      <Route path="/admin/support" component={customerSupport} />
      <Route path="/admin/board" component={BoardManagementPage} />

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
          <AdminProtectedLayout>
            <Router />
          </AdminProtectedLayout>
        </UserProvider>
        <SessionExpiredPopup />
        <Toaster />
      </AdminAssetProvider>
    </QueryClientProvider>
  );
}
