import stadiumBg from "@assets/game/game-stadium-bg.png";
import GameLeftMenu, { type GameMenuAction } from "./GameLeftMenu";
import GameTopScorePanel from "./GameTopScorePanel";
import GameFieldLabels from "./GameFieldLabels";
import GameMenuPanel from "./GameMenuPanel";
import type { LiveScoreboard } from "@shared/apiSportsTypes";

interface LandscapeGameShellProps {
  matchTitle: string;
  stadiumName: string;
  batterText: string;
  scoreboard: LiveScoreboard | null;
  scoreLoading?: boolean;
  matchesLoading?: boolean;
  activePanel: GameMenuAction | null;
  onMenuSelect: (action: GameMenuAction) => void;
  onClosePanel: () => void;
  todayStats?: { total: number; wins: number };
  statsLoading?: boolean;
  emptyMessage?: string;
}

export default function LandscapeGameShell({
  matchTitle,
  stadiumName,
  batterText,
  scoreboard,
  scoreLoading,
  matchesLoading,
  activePanel,
  onMenuSelect,
  onClosePanel,
  todayStats,
  statsLoading,
  emptyMessage,
}: LandscapeGameShellProps) {
  const storyLinks = [
    { label: "승리현황", href: "/victory-history", testId: "link-victory-history" },
    { label: "공지사항", href: "/notice", testId: "link-notice" },
    { label: "나의 콘텐츠", href: "/ebook", testId: "link-ebook" },
    { label: "사회공헌 참여현황", href: "/donation-history", testId: "link-donation" },
  ];

  const infoLinks = [
    { label: "회원정보", href: "/profile", testId: "link-profile" },
    { label: "서비스 이용약관", href: "/terms", testId: "link-terms" },
    { label: "고객센터", href: "/customer-center", testId: "link-customer-center" },
  ];

  return (
    <div
      className="fixed inset-0 w-[100dvw] h-[100dvh] overflow-hidden bg-black flex flex-row"
      data-testid="landscape-game-shell"
    >
      <GameLeftMenu activePanel={activePanel} onSelect={onMenuSelect} />

      <div className="relative flex-1 min-w-0 min-h-0">
        <img
          src={stadiumBg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
          draggable={false}
        />
        <div className="absolute inset-0 bg-black/10" />

        {matchesLoading ? (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <p className="text-white text-sm drop-shadow-lg">경기 정보를 불러오는 중...</p>
          </div>
        ) : emptyMessage ? (
          <div className="absolute inset-0 flex items-center justify-center z-10 px-6">
            <p className="text-white text-center text-sm drop-shadow-lg">{emptyMessage}</p>
          </div>
        ) : (
          <>
            <GameTopScorePanel
              matchTitle={matchTitle}
              stadiumName={stadiumName}
              batterText={batterText}
              scoreboard={scoreboard}
              isLoading={scoreLoading}
            />
            <GameFieldLabels />
          </>
        )}
      </div>

      <GameMenuPanel
        panel={activePanel === "story" || activePanel === "info" ? activePanel : null}
        onClose={onClosePanel}
        storyLinks={storyLinks}
        infoLinks={infoLinks}
        todayStats={todayStats}
        statsLoading={statsLoading}
      />
    </div>
  );
}
