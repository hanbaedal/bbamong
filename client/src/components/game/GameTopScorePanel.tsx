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
  headToHead?: HeadToHeadDisplayParts | null;
  /** @deprecated 문자열 폴백 — headToHead 우선 */
  headToHeadLine?: string | null;
  scoreboard: LiveScoreboard | null;
  currentBatter?: CurrentBatterPreview | null;
  isLoading?: boolean;
  battingHalf?: InningHalf | null;
  onMatchTitleClick?: () => void;
  matchSelectEnabled?: boolean;
}

const titleShadow = "drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]";
const clickable =
  "hover:text-[#CDFF00] transition-colors underline-offset-2 hover:underline cursor-pointer";

/** compact 스코어표 1행 높이 — 한 칸 아래 이동 */
const scorePanelTop = "top-[calc(0.375rem+1.35rem)] sm:top-[calc(0.5rem+1.35rem)]";

function BatterStatsBlock({ batter }: { batter: CurrentBatterPreview }) {
  const nameValue = batter.position
    ? `${formatStatDisplay(batter.playerName)} · ${batter.position}`
    : formatStatDisplay(batter.playerName);
  const cells: { label: string; value: string }[] = [
    { label: "타율", value: formatStatDisplay(batter.battingAverage) },
    { label: "홈런", value: formatStatCount(batter.homeRuns) },
    { label: "안타", value: formatStatCount(batter.hits) },
    { label: "타점", value: formatStatCount(batter.rbi) },
    { label: "득점", value: formatStatCount(batter.runs) },
    { label: "도루", value: formatStatCount(batter.stolenBases) },
    { label: "출루율", value: formatStatDisplay(batter.onBasePercentage) },
    { label: "OPS", value: formatStatDisplay(batter.ops) },
  ];

  return (
    <div
      className="mt-0.5 w-[11.5rem] rounded-md bg-black/55 px-1.5 py-1 text-[10px] sm:text-xs leading-[1.25] text-white/95 backdrop-blur-[2px] pointer-events-none"
      data-testid="current-batter-stats"
    >
      {batter.isPinchHitter ? (
        <p
          className="mb-0.5 text-[10px] sm:text-xs font-bold text-[#CDFF00]"
          data-testid="pinch-hitter-badge"
        >
          대타가 나옵니다
        </p>
      ) : null}
      <p className="truncate font-semibold">{nameValue}</p>
      <p className="mb-0.5 text-white/70">{batter.season} 시즌</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        {cells.map(({ label, value }) => (
          <div key={label} className="flex min-w-0 items-baseline justify-between gap-2">
            <p className="shrink-0 text-[9px] text-white/65 leading-none">{label}</p>
            <p className="truncate font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      {batter.note?.trim() ? (
        <p className="mt-0.5 truncate text-white/80">특징 {batter.note.trim()}</p>
      ) : null}
    </div>
  );
}

function HeadToHeadLine({ parts }: { parts: HeadToHeadDisplayParts }) {
  if (parts.empty) {
    return (
      <p
        className={`mt-0.5 text-right text-[10px] sm:text-[11px] font-normal text-white/80 whitespace-nowrap ${titleShadow}`}
        data-testid="game-match-head-to-head"
      >
        {parts.season} 상대전적 —
      </p>
    );
  }

  return (
    <p
      className={`mt-0.5 text-right text-[10px] sm:text-[11px] font-semibold whitespace-nowrap ${titleShadow}`}
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
  headToHead = null,
  headToHeadLine,
  scoreboard,
  currentBatter = null,
  isLoading,
  battingHalf = null,
  onMatchTitleClick,
  matchSelectEnabled = false,
}: GameTopScorePanelProps) {
  return (
    <>
      <div
        className="absolute top-2 sm:top-2.5 left-1/2 z-20 -translate-x-1/2 text-center text-white pointer-events-none max-w-[46%]"
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
      </div>

      <div
        className={`absolute right-2 sm:right-2.5 z-20 flex flex-col items-end gap-0 pointer-events-none ${scorePanelTop}`}
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
        {!isLoading && headToHead ? (
          <HeadToHeadLine parts={headToHead} />
        ) : !isLoading && headToHeadLine ? (
          <p
            className={`mt-0.5 text-right text-[10px] sm:text-[11px] font-normal text-white/80 whitespace-nowrap ${titleShadow}`}
            data-testid="game-match-head-to-head"
          >
            {headToHeadLine}
          </p>
        ) : null}
        {!isLoading && currentBatter ? (
          <div className="origin-top-right mt-0.5">
            <BatterStatsBlock batter={currentBatter} />
          </div>
        ) : null}
      </div>
    </>
  );
}
