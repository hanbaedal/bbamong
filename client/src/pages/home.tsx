import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Gift } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useUserAssets } from "@/contexts/UserAssetContext";
import LandscapeSplitShell from "@/components/user/LandscapeSplitShell";
import AuthPanelModal from "@/components/user/AuthPanelModal";
import HomeEmbedPanelModal from "@/components/user/HomeEmbedPanelModal";
import UserGuideContent from "@/components/user/UserGuideContent";
import SimpleConfirmPopup from "@/components/customUi/simpleConfirmPopup";
import { setCurrentFriendRoom } from "@/lib/friendRoomSession";
import { navigateUserApp } from "@/lib/landscapeSplitRoutes";
import { USER_GUIDE_OPEN_KEY } from "@/pages/home/user-guide";
import { getFullUrl, queryClient } from "@/lib/queryClient";
import { navigateToMall } from "@/lib/appNavigation";
import { useAndroidImmersiveMode } from "@/hooks/useAndroidImmersiveMode";
import { USER_LOGIN_PATH } from "@/lib/loginSession";
import { clearGuestSessionArtifacts } from "@/lib/shopRoutes";
import {
  HOME_DELAY_PREDICTION_LABEL,
  HOME_FRIEND_ROOM_LABEL,
  HOME_LIVE_PREDICTION_LABEL,
  resolveHomeLivePredictionLabel,
} from "@shared/homeGameEntry";
import { DELAY_GAME_PATH } from "@shared/delayGame";
import sceneBefore from "@assets/game/scene-before.jpg";
import "@/styles/user-landscape.css";

interface HomePageSettings {
  greetingPrefix: string;
  buttonText: string;
  buttonEnabled: boolean;
  gameGuideTitle: string;
  gameGuideEnabled: boolean;
  goodsSectionEnabled: boolean;
}

interface HomePageContent {
  settings: HomePageSettings;
}

type HomeEmbedPanel = {
  id: string;
  title: string;
  href: string;
};

export default function HomePage() {
  const [, setLocation] = useLocation();
  const { user, logout } = useUser();
  const { assets } = useUserAssets();
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const [showUserGuideModal, setShowUserGuideModal] = useState(false);
  const [embedPanel, setEmbedPanel] = useState<HomeEmbedPanel | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem(USER_GUIDE_OPEN_KEY) === "1") {
      sessionStorage.removeItem(USER_GUIDE_OPEN_KEY);
      setShowUserGuideModal(true);
    }
  }, []);

  /** prediction과 동일 — 시스템 내비/상태바 immersive 숨김 */
  useAndroidImmersiveMode();

  const { data: content } = useQuery<HomePageContent>({
    queryKey: ["/api/homepage/content"],
    queryFn: async () => {
      const res = await fetch(getFullUrl("/api/homepage/content"));
      if (!res.ok) throw new Error("Failed to load homepage");
      return res.json();
    },
    staleTime: 60_000,
  });

  const settings = content?.settings;
  const goodsSectionEnabled = settings?.goodsSectionEnabled ?? true;
  const greetingPrefix = settings?.greetingPrefix ?? "안녕하세요";
  const buttonText = useMemo(
    () => resolveHomeLivePredictionLabel(settings?.buttonText ?? HOME_LIVE_PREDICTION_LABEL),
    [settings?.buttonText],
  );
  const buttonEnabled = settings?.buttonEnabled ?? true;
  const gameGuideEnabled = settings?.gameGuideEnabled ?? true;
  const gameGuideTitle = settings?.gameGuideTitle ?? "야구 예측 게임이란?";

  const prefetchPredictionData = () => {
    const img = new Image();
    img.decoding = "async";
    img.src = sceneBefore;
    void queryClient.prefetchQuery({ queryKey: ["/api/matches"] });
    // 종료된 경기 스코어보드는 미리 받지 않는다. 재진입 잔상 방지.
  };

  useEffect(() => {
    prefetchPredictionData();
  }, []);

  const goToGame = () => {
    // 홈「실시간 예측게임」= 공개 예측 (친구방 배지·맥락 해제)
    setCurrentFriendRoom(null);
    prefetchPredictionData();
    navigateUserApp("/prediction", setLocation);
  };

  const goToDelayGame = () => {
    setCurrentFriendRoom(null);
    void queryClient.prefetchQuery({ queryKey: ["/api/delay-game/matches"] });
    navigateUserApp(DELAY_GAME_PATH, setLocation);
  };

  const openEmbed = (panel: HomeEmbedPanel) => {
    setShowUserGuideModal(false);
    setEmbedPanel(panel);
  };

  const handleLogout = async () => {
    clearGuestSessionArtifacts();
    const result = await logout();
    if (!result.nativeHandled) {
      setLocation(USER_LOGIN_PATH);
    }
  };

  const menuItems: Array<{
    id: string;
    label: string;
    onClick: () => void;
    icon: ReactNode;
  }> = [];

  if (gameGuideEnabled) {
    menuItems.push({
      id: "game-guide",
      label: gameGuideTitle,
      onClick: () =>
        openEmbed({
          id: "game-guide",
          title: gameGuideTitle,
          href: "/home/game-guide",
        }),
      icon: <img src={assets.userMascotGuideIcon} alt="" className="user-landscape-menu-icon-img--color" />,
    });
  }

  menuItems.push(
    {
      id: "user-guide",
      label: "사용설명서",
      onClick: () => {
        setEmbedPanel(null);
        setShowUserGuideModal(true);
      },
      icon: <img src={assets.homeMenuManualIcon} alt="" className="user-landscape-menu-icon-img--color" />,
    },
    {
      id: "notice",
      label: "공지사항",
      onClick: () => navigateUserApp("/home/notice", setLocation),
      icon: <img src={assets.homeMenuNoticeIcon} alt="" className="user-landscape-menu-icon-img--color" />,
    },
    {
      id: "inquiry",
      label: "문의하기",
      onClick: () => navigateUserApp("/home/inquiry", setLocation),
      icon: <img src={assets.homeMenuInquiryIcon} alt="" className="user-landscape-menu-icon-img--color" />,
    },
    {
      id: "board",
      label: "게시판",
      onClick: () => navigateUserApp("/home/board", setLocation),
      icon: <img src={assets.homeMenuBoardIcon} alt="" className="user-landscape-menu-icon-img--color" />,
    },
  );

  if (goodsSectionEnabled) {
    menuItems.push({
      id: "gift-box",
      label: "빠몽이 쇼핑센터",
      onClick: () => navigateToMall(),
      icon: <Gift className="w-full h-full" strokeWidth={2} aria-hidden />,
    });
  }

  return (
    <LandscapeSplitShell
      testId="home-page"
      pageClassName="user-landscape-page--home"
      left={
        <div className="user-home-left">
          <div className="user-home-mascot-vcenter">
            <button
              type="button"
              onClick={goToGame}
              className="user-home-mascot-btn"
              aria-label={HOME_LIVE_PREDICTION_LABEL}
              data-testid="button-mascot-game"
            >
              <img src={assets.mainLogo} alt="" className="user-landscape-mascot" />
            </button>
          </div>
          {buttonEnabled ? (
            <button
              type="button"
              data-testid="button-start-prediction"
              onClick={goToGame}
              className="user-home-play-btn"
            >
              <img src={assets.baseballLogo} alt="" />
              {buttonText}
            </button>
          ) : null}
          <button
            type="button"
            data-testid="button-friend-rooms"
            onClick={() => navigateUserApp("/home/rooms", setLocation)}
            className="user-home-friend-room-btn"
          >
            {HOME_FRIEND_ROOM_LABEL}
          </button>
          <button
            type="button"
            data-testid="button-delay-prediction"
            onClick={goToDelayGame}
            className="user-home-friend-room-btn user-home-delay-game-btn"
          >
            {HOME_DELAY_PREDICTION_LABEL}
          </button>
          <a
            className="user-home-credit user-home-credit--left"
            href="https://sports.daum.net/schedule/kbo"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="home-daum-schedule-credit"
          >
            일정 - KBO리그 - Daum 스포츠
          </a>

          <AuthPanelModal
            anchor="left"
            open={showUserGuideModal}
            title="사용설명서"
            onClose={() => setShowUserGuideModal(false)}
            testId="user-guide-modal"
          >
            <UserGuideContent
              onGoSimulation={() => {
                setShowUserGuideModal(false);
                setLocation("/home/simulation");
              }}
              onGoPrediction={() => {
                setShowUserGuideModal(false);
                setCurrentFriendRoom(null);
                setLocation("/prediction");
              }}
            />
          </AuthPanelModal>

          <HomeEmbedPanelModal
            open={embedPanel !== null}
            title={embedPanel?.title ?? ""}
            href={embedPanel?.href ?? null}
            onClose={() => setEmbedPanel(null)}
            testId={embedPanel ? `home-embed-${embedPanel.id}` : "home-embed-modal"}
          />
        </div>
      }
      right={
        <div className="user-home-right">
          <div className="user-home-greeting-row">
            <p className="user-home-greeting-top" data-testid="text-home-greeting">
              {greetingPrefix}
              {user ? (
                <>
                  {" "}
                  <span className="user-home-greeting-name">{user.name}님</span>
                </>
              ) : null}
            </p>
            <button
              type="button"
              onClick={() => setShowLogoutPopup(true)}
              className="user-home-logout-btn"
              aria-label="로그아웃"
              data-testid="button-home-logout"
            >
              <img src={assets.logoutActiveIcon} alt="" />
            </button>
          </div>
          <nav className="user-landscape-menu" aria-label="홈 메뉴">
            {menuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                data-testid={`button-home-${item.id}`}
                className="user-landscape-menu-item"
              >
                <span
                  className={`user-landscape-menu-icon${item.id === "gift-box" ? " user-landscape-menu-icon--gift" : ""}`}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
                <ChevronRight className="menu-chevron" aria-hidden />
              </button>
            ))}
          </nav>
          <p className="user-home-credit user-home-credit--right" data-testid="home-daum-data-credit">
            본 게임은 다음(Daum) 야구 실시간 문자 중계 데이터를 기반으로 운영됩니다.
          </p>
          {showLogoutPopup &&
            createPortal(
              <SimpleConfirmPopup
                message="로그아웃 하시겠어요?"
                leftButtonText="취소"
                rightButtonText="로그아웃"
                onLeftClick={() => setShowLogoutPopup(false)}
                onRightClick={async () => {
                  setShowLogoutPopup(false);
                  await handleLogout();
                }}
              />,
              document.body,
            )}
        </div>
      }
    />
  );
}
