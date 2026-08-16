import LineScoreTableLandscape from "./LineScoreTableLandscape";
import type { CurrentBatterPreview, LiveScoreboard } from "@shared/apiSportsTypes";
import type { InningHalf } from "@shared/gamePhaseTypes";
import { formatStatCount, formatStatDisplay } from "@shared/batterDisplay";

/** 원정(공격 초) */
export const GAME_AWAY_TEAM_COLOR = "#E11936";
/** 홈(공격 말) */
export const GAME_HOME_TEAM_COLOR = "#1A6DFF";

interface GameTopScorePanelProps {
  matchTitle: string;
  stadiumName?: string | null;
  scoreboard: LiveScoreboard | null;
  currentBatter?: CurrentBatterPreview | null;
  isLoading?: boolean;
  battingHalf?: InningHalf | null;
  onMatchTitleClick?: () => void;
  matchSelectEnabled?: boolean;
  stadiumSelectEnabled?: boolean;
  onStadiumNameClick?: () => void;
}

const titleShadow = "drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]";
const clickable =
  "hover:text-[#CDFF00] transition-colors underline-offset-2 hover:underline cursor-pointer";

/** 스코어표 — 한 줄 위 (기존 +1.35rem 오프셋 제거) */
const scorePanelTop = "top-2 sm:top-2.5";

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
      <p className="truncate font-semibold">
        <span className="text-white/80" data-testid="current-batter-order">
          {batter.orderLabel}
        </span>{" "}
        {nameValue}
      </p>
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

export default function GameTopScorePanel({
  matchTitle,
  stadiumName = null,
  scoreboard,
  currentBatter = null,
  isLoading,
  battingHalf = null,
  onMatchTitleClick,
  matchSelectEnabled = false,
  stadiumSelectEnabled = false,
  onStadiumNameClick,
}: GameTopScorePanelProps) {
  const titleClass = `text-sm sm:text-base font-bold leading-none whitespace-nowrap text-white ${titleShadow}`;
  const displayStadium = stadiumName?.trim() || null;

  return (
    <div
      className={`absolute right-2 sm:right-2.5 z-20 flex flex-col items-end gap-0 pointer-events-none text-white ${scorePanelTop}`}
      data-testid="game-top-score-panel"
    >
      <div className="relative w-max max-w-full" data-testid="game-match-header">
        {/* 스코어표 원정 행 왼쪽 — 제n경기 + 바로 아래 구장명 */}
        <div className="absolute right-full top-[36%] z-10 mr-1.5 -translate-y-1/2 flex flex-col items-end gap-0.5">
          {matchTitle.trim() ? (
            matchSelectEnabled && onMatchTitleClick ? (
              <button
                type="button"
                onClick={onMatchTitleClick}
                className={`pointer-events-auto ${titleClass} ${clickable}`}
                data-testid="game-match-title"
              >
                {matchTitle}
              </button>
            ) : (
              <p className={titleClass} data-testid="game-match-title">
                {matchTitle}
              </p>
            )
          ) : null}
          {displayStadium ? (
            stadiumSelectEnabled && onStadiumNameClick ? (
              <button
                type="button"
                onClick={onStadiumNameClick}
                className={`pointer-events-auto text-[10px] sm:text-[11px] leading-tight text-white/90 whitespace-nowrap ${titleShadow} ${clickable}`}
                data-testid="game-stadium-name"
              >
                {displayStadium}
              </button>
            ) : (
              <p
                className={`text-[10px] sm:text-[11px] leading-tight text-white/90 whitespace-nowrap ${titleShadow}`}
                data-testid="game-stadium-name"
              >
                {displayStadium}
              </p>
            )
          ) : null}
        </div>
        <div style={{ zoom: 0.7 }}>
          {isLoading ? (
            <p className="text-[10px] text-white/80 py-2">스코어 불러오는 중...</p>
          ) : scoreboard ? (
            <LineScoreTableLandscape
              scoreboard={scoreboard}
              className="max-w-full"
              compact
              battingHalf={battingHalf}
            />
          ) : null}
        </div>
      </div>
      {!isLoading && currentBatter ? (
        <div className="origin-top-right mt-0.5">
          <BatterStatsBlock batter={currentBatter} />
        </div>
      ) : null}
    </div>
  );
}
