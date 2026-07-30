import LineScoreTableLandscape from "./LineScoreTableLandscape";
import type { LiveScoreboard } from "@shared/apiSportsTypes";

interface GameTopScorePanelProps {
  matchTitle: string;
  stadiumName: string;
  batterText: string;
  scoreboard: LiveScoreboard | null;
  isLoading?: boolean;
}

export default function GameTopScorePanel({
  matchTitle,
  stadiumName,
  batterText,
  scoreboard,
  isLoading,
}: GameTopScorePanelProps) {
  return (
    <div
      className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20 flex flex-col items-end gap-1 max-w-[min(92vw,520px)]"
      data-testid="game-top-score-panel"
    >
      <div className="text-right text-white drop-shadow-md">
        <p className="text-sm sm:text-base font-bold leading-tight" data-testid="game-match-title">
          {matchTitle}
        </p>
        <p className="text-xs sm:text-sm text-white/90" data-testid="game-stadium-name">
          {stadiumName || "경기장 이름"}
        </p>
      </div>

      {isLoading ? (
        <p className="text-xs text-white/80">스코어 불러오는 중...</p>
      ) : (
        <LineScoreTableLandscape scoreboard={scoreboard} className="max-w-full" />
      )}

      <p
        className="text-sm sm:text-base font-semibold text-white drop-shadow-md mt-0.5"
        data-testid="game-batter-text"
      >
        {batterText}
      </p>
    </div>
  );
}
