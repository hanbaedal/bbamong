import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ShoppingBag } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useUserAssets } from "@/contexts/UserAssetContext";
import LandscapeSplitShell from "@/components/user/LandscapeSplitShell";
import { getFullUrl } from "@/lib/queryClient";
import { navigateToMall } from "@/lib/appNavigation";
import { resolveShopSectionTitle } from "@/lib/shopBranding";
import "@/styles/user-landscape.css";

interface HomePageSettings {
  greetingPrefix: string;
  buttonText: string;
  buttonEnabled: boolean;
  gameGuideTitle: string;
  gameGuideEnabled: boolean;
  goodsSectionTitle: string;
  goodsSectionEnabled: boolean;
}

interface HomePageContent {
  settings: HomePageSettings;
}

export default function HomePage() {
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { assets } = useUserAssets();

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
  const buttonText = settings?.buttonText ?? "게임하러가기";
  const buttonEnabled = settings?.buttonEnabled ?? true;
  const gameGuideEnabled = settings?.gameGuideEnabled ?? true;
  const gameGuideTitle = settings?.gameGuideTitle ?? "야구 예측 게임이란?";
  const mallLabel = resolveShopSectionTitle(settings?.goodsSectionTitle);

  const goToGame = () => setLocation("/prediction");

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
      onClick: () => setLocation("/home/game-guide"),
      icon: <img src={assets.predictionActiveLogo} alt="" />,
    });
  }

  menuItems.push(
    {
      id: "user-guide",
      label: "사용 설명서",
      onClick: () => setLocation("/home/guide"),
      icon: <img src={assets.qnaIcon} alt="" />,
    },
    {
      id: "simulation",
      label: "게임 시뮬레이션",
      onClick: () => setLocation("/home/simulation"),
      icon: <img src={assets.videoImg} alt="" />,
    },
  );

  if (goodsSectionEnabled) {
    menuItems.push({
      id: "mall",
      label: mallLabel,
      onClick: () => navigateToMall(),
      icon: <ShoppingBag className="w-full h-full text-[#CDFF00]" strokeWidth={2} aria-hidden />,
    });
  }

  return (
    <LandscapeSplitShell
      testId="home-page"
      left={
        <div className="user-home-left">
          <div className="user-home-mascot-vcenter">
            <button
              type="button"
              onClick={goToGame}
              className="user-home-mascot-btn"
              aria-label="게임하러 가기"
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
        </div>
      }
      right={
        <div className="user-home-right">
          <p className="user-home-greeting-top" data-testid="text-home-greeting">
            {greetingPrefix}
            {user ? (
              <>
                {" "}
                <span className="user-home-greeting-name">{user.name}님</span>
              </>
            ) : null}
          </p>
          <nav className="user-landscape-menu" aria-label="홈 메뉴">
            {menuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                data-testid={`button-home-${item.id}`}
                className="user-landscape-menu-item"
              >
                <span className="user-landscape-menu-icon">{item.icon}</span>
                <span>{item.label}</span>
                <ChevronRight className="menu-chevron" aria-hidden />
              </button>
            ))}
          </nav>
        </div>
      }
    />
  );
}
