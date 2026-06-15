import { Switch, Route } from "wouter";
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
import ManagerListPage from "@/adminPages/admins/ManagerList";
import MatchAssignmentPage from "@/adminPages/admins/ManagerMatchAssignment";
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
import { adminQueryClient } from "./lib/adminQueryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { AdminAssetProvider } from "@/contexts/AdminAssetContext";
import { SessionExpiredPopup } from "@/components/SessionExpiredPopup";
import { UserProvider } from "./contexts/UserContext";

function Router() {
  return (
    <Switch>
      {/* 루트 도메인 → 어드민 로그인 */}
      <Route path="/" component={AdminLoginPage} />
      {/* 로그인 / 회원가입 / 대기 페이지 */}
      <Route path="/admin/login" component={AdminLoginPage} />
      <Route path="/admin/signup" component={AdminSignupPage} />
      <Route path="/admin/waiting" component={AdminWaitingPage} />
      <Route path="/admin/home" component={AdminHomePage} />
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

      {/* 관리자 관리 */}
      <Route path="/admin/staff" component={StaffListPage} />
      <Route path="/admin/managers" component={ManagerListPage} />
      <Route path="/admin/match-assignment" component={MatchAssignmentPage} />
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
