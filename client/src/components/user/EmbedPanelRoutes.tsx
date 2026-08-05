import { useCallback, useEffect, useState } from "react";
import { Router, Route, Switch, useLocation } from "wouter";
import { registerEmbedPanel } from "@/lib/embedPanelController";
import GameGuidePage from "@/pages/home/game-guide";
import NoticePage from "@/pages/setting/notice";
import NoticeDetailPage from "@/pages/setting/notice-detail";
import CustomerCenterPage from "@/pages/setting/customer-center";
import InquiryCreatePage from "@/pages/setting/inquiry-create";
import InquiryDetailPage from "@/pages/setting/inquiry-detail";
import BoardPage from "@/pages/board";
import CreatePostPage from "@/pages/create-post";
import PostDetailPage from "@/pages/post-detail";
import VictoryHistoryPage from "@/pages/setting/victory-history";
import InvitePage from "@/pages/setting/invite";
import AttendancePage from "@/pages/attendance";
import EbookPage from "@/pages/setting/ebook";
import DonationHistoryPage from "@/pages/setting/donation-history";
import VerifyIdentityPage from "@/pages/setting/verify-identity";
import ProfilePage from "@/pages/setting/profile";
import PointPage from "@/pages/point";
import PointHistoryPage from "@/pages/point-history";
import FaqPage from "@/pages/setting/faq";
import TermsOfServicePage from "@/pages/setting/terms-of-service";


function EmbedPanelRegistrar({
  rootPath,
  onClose,
  onAppNavigate,
}: {
  rootPath: string;
  onClose: () => void;
  onAppNavigate?: (path: string) => void;
}) {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    return registerEmbedPanel({
      rootPath,
      getLocation: () => location,
      setLocation,
      onClose,
      onAppNavigate,
    });
  }, [rootPath, location, setLocation, onClose, onAppNavigate]);

  return null;
}

function EmbedPanelSwitch() {
  return (
    <Switch>
      <Route path="/home/game-guide" component={GameGuidePage} />
      <Route path="/notice/:id" component={NoticeDetailPage} />
      <Route path="/notice" component={NoticePage} />
      <Route path="/inquiry/create" component={InquiryCreatePage} />
      <Route path="/inquiry/:id" component={InquiryDetailPage} />
      <Route path="/customer-center" component={CustomerCenterPage} />
      <Route path="/board/create" component={CreatePostPage} />
      <Route path="/board/:id" component={PostDetailPage} />
      <Route path="/board" component={BoardPage} />
      <Route path="/victory-history" component={VictoryHistoryPage} />
      <Route path="/invitation" component={InvitePage} />
      <Route path="/attendance" component={AttendancePage} />
      <Route path="/ebook" component={EbookPage} />
      <Route path="/donation-history" component={DonationHistoryPage} />
      <Route path="/verify-identity" component={VerifyIdentityPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/point/history" component={PointHistoryPage} />
      <Route path="/point" component={PointPage} />
      <Route path="/faq" component={FaqPage} />
      <Route path="/terms" component={TermsOfServicePage} />
    </Switch>
  );
}

interface EmbedPanelRoutesProps {
  initialPath: string;
  onClose: () => void;
  onAppNavigate?: (path: string) => void;
  className?: string;
  testId?: string;
}

/** 패널 내부 — memory router + 페이지 컴포넌트 직접 렌더 (iframe 없음) */
export default function EmbedPanelRoutes({
  initialPath,
  onClose,
  onAppNavigate,
  className = "",
  testId = "embed-panel-routes",
}: EmbedPanelRoutesProps) {
  const rootPath = initialPath.split("?")[0];

  return (
    <div
      className={`panel-embed h-full min-h-0 flex flex-col overflow-hidden bg-[#111111] ${className}`}
      data-testid={testId}
    >
      <PanelMemoryRouter
        initialPath={initialPath}
        rootPath={rootPath}
        onClose={onClose}
        onAppNavigate={onAppNavigate}
      />
    </div>
  );
}

function PanelMemoryRouter({
  initialPath,
  rootPath,
  onClose,
  onAppNavigate,
}: {
  initialPath: string;
  rootPath: string;
  onClose: () => void;
  onAppNavigate?: (path: string) => void;
}) {
  const [location, setLocation] = useState(initialPath);

  useEffect(() => {
    setLocation(initialPath);
  }, [initialPath]);

  const hook = useCallback((): [string, (to: string) => void] => {
    return [location, setLocation];
  }, [location, setLocation]);

  return (
    <Router hook={hook}>
      <EmbedPanelRegistrar
        rootPath={rootPath}
        onClose={onClose}
        onAppNavigate={onAppNavigate}
      />
      <div className="flex-1 min-h-0 overflow-auto">
        <EmbedPanelSwitch />
      </div>
    </Router>
  );
}
