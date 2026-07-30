import LineScoreTableLandscape from "./LineScoreTableLandscape";
import type { LiveScoreboard } from "@shared/apiSportsTypes";
import type { InningHalf } from "@shared/gamePhaseTypes";

interface GameTopScorePanelProps {
  matchTitle: string;
  stadiumName: string;
  batterText: string;
  scoreboard: LiveScoreboard | null;
  isLoading?: boolean;
  battingHalf?: InningHalf | null;
  onMatchTitleClick?: () => void;
  onStadiumNameClick?: () => void;
  matchSelectEnabled?: boolean;
  stadiumSelectEnabled?: boolean;
}

const titleShadow = "drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]";
const clickable =
  "hover:text-[#CDFF00] transition-colors underline-offset-2 hover:underline cursor-pointer";

/** compact 스코어표 1행 높이 — 한 칸 아래 이동 */
const scorePanelTop = "top-[calc(0.375rem+1.35rem)] sm:top-[calc(0.5rem+1.35rem)]";

export default function GameTopScorePanel({
  matchTitle,
  stadiumName,
  batterText,
  scoreboard,
  isLoading,
  battingHalf = null,
  onMatchTitleClick,
  onStadiumNameClick,
  matchSelectEnabled = false,
  stadiumSelectEnabled = false,
}: GameTopScorePanelProps) {
  const displayStadiumName = stadiumName.trim() || null;
  return (
    <>
      {/* 상단 중앙: 제 N경기 + 경기장 이름 — 바깥(좌)으로 약 1글자 */}
      <div
        className="absolute top-2 sm:top-2.5 left-1/2 z-20 text-center text-white pointer-events-none max-w-[50%] -translate-x-[calc(50%+1ch)]"
        data-testid="game-match-header"
      >
        {matchSelectEnabled && onMatchTitleClick ? (
          <button
            type="button"
            onClick={onMatchTitleClick}
            className={`pointer-events-auto block w-full text-lg sm:text-xl font-bold leading-tight whitespace-nowrap ${titleShadow} ${clickable}`}
            data-testid="game-match-title"
          >
            {matchTitle}
          </button>
        ) : (
          <p
            className={`text-lg sm:text-xl font-bold leading-tight whitespace-nowrap ${titleShadow}`}
            data-testid="game-match-title"
          >
            {matchTitle}
          </p>
        )}

        {displayStadiumName ? (
          matchSelectEnabled && onStadiumNameClick ? (
            <button
              type="button"
              onClick={onStadiumNameClick}
              className={`pointer-events-auto block w-full mt-0.5 text-xs sm:text-sm font-normal text-white whitespace-nowrap ${titleShadow} ${clickable}`}
              data-testid="game-stadium-name"
            >
              {displayStadiumName}
            </button>
          ) : (
            <p
              className={`mt-0.5 text-xs sm:text-sm font-normal text-white whitespace-nowrap ${titleShadow}`}
              data-testid="game-stadium-name"
            >
              {displayStadiumName}
            </p>
          )
        ) : null}
      </div>

      {/* 우측: 스코어보드 + n번째 타자 (한 칸 아래, 함께 이동) */}
      <div
        className={`absolute right-2 sm:right-2.5 z-20 flex flex-col items-end gap-1 sm:gap-1.5 ${scorePanelTop}`}
        data-testid="game-top-score-panel"
      >
        <div className="origin-top-right scale-[0.68] sm:scale-[0.72]">
          {isLoading ? (
            <p className="text-[10px] text-white/80 py-2">스코어 불러오는 중...</p>
          ) : (
            <LineScoreTableLandscape
              scoreboard={scoreboard}
              className="max-w-full"
              compact
              battingHalf={battingHalf}
            />
          )}
        </div>
        <p
          className={`text-sm sm:text-base font-bold text-white whitespace-nowrap pr-0.5 ${titleShadow}`}
          data-testid="game-batter-text"
        >
          {batterText}
        </p>
      </div>
    </>
  );
}
