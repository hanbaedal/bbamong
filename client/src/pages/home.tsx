import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useUserAssets } from "@/contexts/UserAssetContext";
import LandscapeSplitShell from "@/components/user/LandscapeSplitShell";
import { getFullUrl } from "@/lib/queryClient";
import { navigateToMall } from "@/lib/appNavigation";
import "@/styles/user-landscape.css";

interface HomePageSettings {
  greetingPrefix: string;
  subGreeting: string;
  buttonText: string;
  buttonEnabled: boolean;
  showDate: boolean;
  gameGuideTitle: string;
  gameGuideSummary: string;
  gameGuideEnabled: boolean;
  goodsSectionTitle: string;
  goodsSectionEnabled: boolean;
  introVideoUrl?: string;
}

interface HomePageContent {
  settings: HomePageSettings;
}

export default function HomePage() {
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { assets } = useUserAssets();
  const [formattedDate, setFormattedDate] = useState("");

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
  const goodsSectionTitle = settings?.goodsSectionTitle ?? "홈페이지";
  const greetingPrefix = settings?.greetingPrefix ?? "안녕하세요";
  const buttonText = settings?.buttonText ?? "게임하러가기";
  const buttonEnabled = settings?.buttonEnabled ?? true;
  const showDate = settings?.showDate ?? true;
  const gameGuideEnabled = settings?.gameGuideEnabled ?? true;
  const gameGuideTitle = settings?.gameGuideTitle ?? "야구 예측 게임이란?";

  useEffect(() => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
    };
    const localeDate = now.toLocaleDateString("ko-KR", options);
    const parts = localeDate.split(" ");
    const year = parts[0].replace(".", "년");
    const month = parts[1].replace(".", "월");
    const day = parts[2].replace(".", "일");
    const weekday = parts[3];
    setFormattedDate(`${year} ${month} ${day} ${weekday}`);
  }, []);

  const goToGame = () => setLocation("/prediction");

  const mallLabel =
    goodsSectionTitle === "홈페이지" ? "빠몽이 기념품 사러가기" : goodsSectionTitle;

  const menuItems: Array<{ id: string; label: string; onClick: () => void; icon?: ReactNode }> = [];

  if (gameGuideEnabled) {
    menuItems.push({
      id: "game-guide",
      label: gameGuideTitle,
      onClick: () => setLocation("/home/game-guide"),
      icon: <img src={assets.baseballLogo} alt="" />,
    });
  }

  menuItems.push(
    {
      id: "user-guide",
      label: "사용 설명서",
      onClick: () => setLocation("/home/guide"),
      icon: <span>?</span>,
    },
    {
      id: "simulation",
      label: "게임 시뮬레이션",
      onClick: () => setLocation("/home/simulation"),
      icon: <img src={assets.baseballLogo} alt="" />,
    },
  );

  if (goodsSectionEnabled) {
    menuItems.push({
      id: "mall",
      label: mallLabel,
      onClick: () => navigateToMall(),
      icon: <img src={assets.mainLogo} alt="" />,
    });
  }

  return (
    <LandscapeSplitShell
      testId="home-page"
      left={
        <div className="user-home-left">
          {showDate && formattedDate ? (
            <p className="user-home-date" data-testid="text-home-date">
              {formattedDate}
            </p>
          ) : null}
          <button
            type="button"
            onClick={goToGame}
            className="border-0 bg-transparent p-0 cursor-pointer"
            aria-label="게임하러 가기"
            data-testid="button-mascot-game"
          >
            <img
              src={assets.mainLogo}
              alt=""
              className="user-landscape-mascot"
            />
          </button>
          <p className="user-home-greeting" data-testid="text-home-greeting">
            {greetingPrefix}
            {user ? (
              <>
                {" "}
                <span className="user-home-greeting-name">{user.name}님</span>
              </>
            ) : null}
          </p>
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
      }
    />
  );
}
