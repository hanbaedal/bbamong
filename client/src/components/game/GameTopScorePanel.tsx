import LineScoreTableLandscape from "./LineScoreTableLandscape";
import type { LiveScoreboard } from "@shared/apiSportsTypes";

interface GameTopScorePanelProps {
  matchTitle: string;
  stadiumName: string;
  batterText: string;
  scoreboard: LiveScoreboard | null;
  isLoading?: boolean;
  onMatchTitleClick?: () => void;
  onStadiumNameClick?: () => void;
  matchSelectEnabled?: boolean;
  stadiumSelectEnabled?: boolean;
}

export default function GameTopScorePanel({
  matchTitle,
  stadiumName,
  batterText,
  scoreboard,
  isLoading,
  onMatchTitleClick,
  onStadiumNameClick,
  matchSelectEnabled = false,
  stadiumSelectEnabled = false,
}: GameTopScorePanelProps) {
  return (
    <div
      className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-20 origin-top-right scale-[0.7]"
      data-testid="game-top-score-panel"
    >
      <div className="flex flex-row items-start gap-2 sm:gap-3">
        {/* 스코어판 왼쪽: 제 N경기 + n번째 타자 */}
        <div className="flex flex-col justify-center gap-1 pt-1 shrink-0 text-white drop-shadow-md min-w-[4.5rem]">
          {matchSelectEnabled && onMatchTitleClick ? (
            <button
              type="button"
              onClick={onMatchTitleClick}
              className="text-sm sm:text-base font-bold leading-tight whitespace-nowrap text-left hover:text-[#CDFF00] transition-colors underline-offset-2 hover:underline"
              data-testid="game-match-title"
            >
              {matchTitle}
            </button>
          ) : (
            <p
              className="text-sm sm:text-base font-bold leading-tight whitespace-nowrap"
              data-testid="game-match-title"
            >
              {matchTitle}
            </p>
          )}
          <p
            className="text-xs sm:text-sm font-bold leading-tight whitespace-nowrap"
            data-testid="game-batter-text"
          >
            {batterText}
          </p>
        </div>

        {/* 스코어판 + 아래 중앙 경기장 이름 (표만 약 2칸 왼쪽) */}
        <div className="flex flex-col items-center min-w-0 -translate-x-12 sm:-translate-x-[3.25rem]">
          {isLoading ? (
            <p className="text-[10px] text-white/80 py-2">스코어 불러오는 중...</p>
          ) : (
            <LineScoreTableLandscape scoreboard={scoreboard} className="max-w-full" compact />
          )}
          {stadiumSelectEnabled && onStadiumNameClick ? (
            <button
              type="button"
              onClick={onStadiumNameClick}
              className="text-[10px] sm:text-xs text-white/95 font-normal drop-shadow-md mt-1 text-center w-full whitespace-nowrap hover:text-[#CDFF00] transition-colors underline-offset-2 hover:underline"
              data-testid="game-stadium-name"
            >
              {stadiumName || "경기장 이름"}
            </button>
          ) : (
            <p
              className="text-[10px] sm:text-xs text-white/95 font-normal drop-shadow-md mt-1 text-center w-full whitespace-nowrap"
              data-testid="game-stadium-name"
            >
              {stadiumName || "경기장 이름"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
