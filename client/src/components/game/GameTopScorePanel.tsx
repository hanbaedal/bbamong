import LineScoreTableLandscape from "./LineScoreTableLandscape";
import type { CurrentBatterPreview, LiveScoreboard } from "@shared/apiSportsTypes";
import type { InningHalf } from "@shared/gamePhaseTypes";
import { formatStatCount, formatStatDisplay } from "@shared/batterDisplay";

interface GameTopScorePanelProps {
  matchTitle: string;
  stadiumName: string;
  teamNamesLine?: string | null;
  headToHeadLine?: string | null;
  scoreboard: LiveScoreboard | null;
  currentBatter?: CurrentBatterPreview | null;
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

function BatterStatsBlock({ batter }: { batter: CurrentBatterPreview }) {
  const seasonLabel = `${batter.season} 타율`;
  const rows: { label: string; value: string; indent?: boolean }[] = [
    { label: "타자 이름", value: formatStatDisplay(batter.playerName) },
    { label: seasonLabel, value: formatStatDisplay(batter.battingAverage) },
    { label: "안타", value: formatStatCount(batter.hits), indent: true },
    { label: "홈런", value: formatStatCount(batter.homeRuns), indent: true },
    { label: "타점", value: formatStatCount(batter.rbi), indent: true },
    { label: "OPS", value: formatStatDisplay(batter.ops), indent: true },
  ];

  return (
    <div
      className="mt-1 min-w-[8.5rem] rounded-sm bg-black/45 px-1.5 py-1 text-[9px] leading-[1.35] text-white/95 backdrop-blur-[2px]"
      data-testid="current-batter-stats"
    >
      {rows.map(({ label, value, indent }) => (
        <div
          key={label}
          className={`grid grid-cols-[4.5rem_1fr] gap-x-1 ${indent ? "pl-2" : ""}`}
        >
          <span className="text-white/75 whitespace-nowrap">{label}</span>
          <span className="text-right font-medium tabular-nums">{value}</span>
        </div>
      ))}
    </div>
  );
}

export default function GameTopScorePanel({
  matchTitle,
  stadiumName,
  teamNamesLine,
  headToHeadLine,
  scoreboard,
  currentBatter = null,
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

        {teamNamesLine ? (
          <p
            className={`mt-0.5 text-xs sm:text-sm font-normal text-white/95 whitespace-nowrap ${titleShadow}`}
            data-testid="game-match-teams"
          >
            {teamNamesLine}
          </p>
        ) : null}

        {headToHeadLine ? (
          <p
            className={`mt-0.5 text-[10px] sm:text-xs font-normal text-white/80 whitespace-nowrap ${titleShadow}`}
            data-testid="game-match-head-to-head"
          >
            {headToHeadLine}
          </p>
        ) : null}
      </div>

      {/* 우측: 스코어보드 + 현재 타자 기록 */}
      <div
        className={`absolute right-2 sm:right-2.5 z-20 flex flex-col items-end gap-0 ${scorePanelTop}`}
        data-testid="game-top-score-panel"
      >
        <div className="origin-top-right scale-[0.68] sm:scale-[0.72]">
          {isLoading ? (
            <p className="text-[10px] text-white/80 py-2">스코어 불러오는 중...</p>
          ) : (
            <>
              <LineScoreTableLandscape
                scoreboard={scoreboard}
                className="max-w-full"
                compact
                battingHalf={battingHalf}
              />
              {currentBatter ? <BatterStatsBlock batter={currentBatter} /> : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}
