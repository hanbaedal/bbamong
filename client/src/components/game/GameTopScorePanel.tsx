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
      className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-20 flex flex-col items-end gap-0.5 origin-top-right scale-[0.7]"
      data-testid="game-top-score-panel"
    >
      <div className="text-right text-white drop-shadow-md">
        <p className="text-xs sm:text-sm font-bold leading-tight" data-testid="game-match-title">
          {matchTitle}
        </p>
        <p className="text-[10px] sm:text-xs text-white/90" data-testid="game-stadium-name">
          {stadiumName || "경기장 이름"}
        </p>
      </div>

      {isLoading ? (
        <p className="text-[10px] text-white/80">스코어 불러오는 중...</p>
      ) : (
        <LineScoreTableLandscape scoreboard={scoreboard} className="max-w-full" compact />
      )}

      <p
        className="text-[10px] sm:text-xs font-semibold text-white drop-shadow-md"
        data-testid="game-batter-text"
      >
        {batterText}
      </p>
    </div>
  );
}
