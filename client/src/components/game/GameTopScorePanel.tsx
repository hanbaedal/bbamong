import LineScoreTableLandscape from "./LineScoreTableLandscape";
import type { CurrentBatterPreview, LiveScoreboard } from "@shared/apiSportsTypes";
import type { InningHalf } from "@shared/gamePhaseTypes";
import { formatStatCount, formatStatDisplay } from "@shared/batterDisplay";
import type { HeadToHeadDisplayParts } from "@shared/matchTeamDisplay";

/** 원정(공격 초) */
export const GAME_AWAY_TEAM_COLOR = "#E11936";
/** 홈(공격 말) */
export const GAME_HOME_TEAM_COLOR = "#1A6DFF";

interface GameTopScorePanelProps {
  matchTitle: string;
  stadiumName: string;
  teamNamesLine?: string | null;
  headToHead?: HeadToHeadDisplayParts | null;
  /** @deprecated 문자열 폴백 — headToHead 우선 */
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
      className="mt-1.5 min-w-[11rem] rounded-md bg-black/55 px-2 py-1.5 text-[12px] sm:text-[13px] leading-[1.45] text-white/95 backdrop-blur-[2px]"
      data-testid="current-batter-stats"
    >
      {batter.isPinchHitter ? (
        <p
          className="mb-1 text-[12px] sm:text-[13px] font-bold text-[#CDFF00]"
          data-testid="pinch-hitter-badge"
        >
          대타가 나옵니다
        </p>
      ) : null}
      {rows.map(({ label, value, indent }) => (
        <div
          key={label}
          className={`grid grid-cols-[5.25rem_1fr] gap-x-1.5 ${indent ? "pl-2" : ""}`}
        >
          <span className="text-white/80 whitespace-nowrap">{label}</span>
          <span className="text-right font-semibold tabular-nums">{value}</span>
        </div>
      ))}
    </div>
  );
}

function HeadToHeadLine({ parts }: { parts: HeadToHeadDisplayParts }) {
  if (parts.empty) {
    return (
      <p
        className={`mt-0.5 text-[10px] sm:text-xs font-normal text-white/80 whitespace-nowrap ${titleShadow}`}
        data-testid="game-match-head-to-head"
      >
        {parts.season} 상대전적 —
      </p>
    );
  }

  return (
    <p
      className={`mt-0.5 text-[10px] sm:text-xs font-semibold whitespace-nowrap ${titleShadow}`}
      data-testid="game-match-head-to-head"
    >
      <span className="text-white/85 font-normal">{parts.season} 상대전적 </span>
      <span style={{ color: GAME_AWAY_TEAM_COLOR }}>
        {parts.awayName} {parts.awayWins}승
      </span>
      <span className="text-white/70 font-normal"> : </span>
      <span style={{ color: GAME_HOME_TEAM_COLOR }}>
        {parts.homeName} {parts.homeWins}승
      </span>
    </p>
  );
}

export default function GameTopScorePanel({
  matchTitle,
  stadiumName,
  teamNamesLine,
  headToHead = null,
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

        {headToHead ? (
          <p
            className={`mt-0.5 text-xs sm:text-sm font-semibold whitespace-nowrap ${titleShadow}`}
            data-testid="game-match-teams"
          >
            <span style={{ color: GAME_AWAY_TEAM_COLOR }}>{headToHead.awayName}</span>
            <span className="text-white/70 font-normal"> : </span>
            <span style={{ color: GAME_HOME_TEAM_COLOR }}>{headToHead.homeName}</span>
          </p>
        ) : teamNamesLine ? (
          <p
            className={`mt-0.5 text-xs sm:text-sm font-normal text-white/95 whitespace-nowrap ${titleShadow}`}
            data-testid="game-match-teams"
          >
            {teamNamesLine}
          </p>
        ) : null}

        {headToHead ? (
          <HeadToHeadLine parts={headToHead} />
        ) : headToHeadLine ? (
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
            <LineScoreTableLandscape
              scoreboard={scoreboard}
              className="max-w-full"
              compact
              battingHalf={battingHalf}
            />
          )}
        </div>
        {!isLoading && currentBatter ? (
          <div className="origin-top-right mt-0.5">
            <BatterStatsBlock batter={currentBatter} />
          </div>
        ) : null}
      </div>
    </>
  );
}
