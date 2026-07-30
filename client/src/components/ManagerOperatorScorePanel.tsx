import LineScoreTable from "@/components/LineScoreTable";
import type { LiveScoreboard } from "@shared/apiSportsTypes";
import { formatInningWithHalf, parseInningHalf, type InningHalf } from "@shared/gamePhaseTypes";

interface ManagerOperatorScorePanelProps {
  scoreboard: LiveScoreboard | null;
  /** API 없을 때 운영자 DB 공수 */
  gameInning?: number | null;
  inningHalf?: string | InningHalf | null;
  matchStatus?: string;
}

function resolveBattingHalf(
  scoreboard: LiveScoreboard | null,
  inningHalf?: string | InningHalf | null,
): InningHalf | null {
  if (scoreboard?.inningHalf) {
    return parseInningHalf(scoreboard.inningHalf);
  }
  if (inningHalf) {
    return parseInningHalf(typeof inningHalf === "string" ? inningHalf : inningHalf);
  }
  return null;
}

function resolveInningLabel(
  scoreboard: LiveScoreboard | null,
  gameInning?: number | null,
  inningHalf?: string | InningHalf | null,
): string {
  if (scoreboard?.inning != null && scoreboard.inningHalf) {
    return formatInningWithHalf(scoreboard.inning, parseInningHalf(scoreboard.inningHalf));
  }
  if (scoreboard?.inningLabel && /회\s*(초|말)/.test(scoreboard.inningLabel)) {
    return scoreboard.inningLabel;
  }
  const half = resolveBattingHalf(scoreboard, inningHalf);
  if (gameInning != null && half) {
    return formatInningWithHalf(gameInning, half);
  }
  return "";
}

export default function ManagerOperatorScorePanel({
  scoreboard,
  gameInning,
  inningHalf,
  matchStatus,
}: ManagerOperatorScorePanelProps) {
  if (!scoreboard) {
    return (
      <div className="manager-operator-score manager-operator-score--empty" data-testid="manager-score-panel">
        <p className="manager-operator-score-placeholder">스코어 연동 대기 중</p>
      </div>
    );
  }

  const awayLabel = scoreboard.awayTeamName || "원정팀";
  const homeLabel = scoreboard.homeTeamName || "홈팀";
  const battingHalf = resolveBattingHalf(scoreboard, inningHalf);
  const inningPhaseLabel = resolveInningLabel(scoreboard, gameInning, inningHalf);
  const showPhase = matchStatus === "ongoing" && Boolean(inningPhaseLabel);
  const awayBatting = showPhase && battingHalf === "top";
  const homeBatting = showPhase && battingHalf === "bottom";

  return (
    <div className="manager-operator-score" data-testid="manager-score-panel">
      <div className="manager-operator-score-summary">
        <div className="manager-operator-score-team manager-operator-score-team--away">
          <span className="manager-operator-score-team-name">{awayLabel}</span>
          {awayBatting && (
            <span className="manager-operator-score-phase" data-testid="manager-score-phase-away">
              {inningPhaseLabel}
            </span>
          )}
        </div>

        <div className="manager-operator-score-totals" data-testid="manager-score-totals">
          <span>{scoreboard.awayScore}</span>
          <span className="manager-operator-score-colon">:</span>
          <span>{scoreboard.homeScore}</span>
        </div>

        <div className="manager-operator-score-team manager-operator-score-team--home">
          {homeBatting && (
            <span className="manager-operator-score-phase" data-testid="manager-score-phase-home">
              {inningPhaseLabel}
            </span>
          )}
          <span className="manager-operator-score-team-name">{homeLabel}</span>
        </div>
      </div>

      <LineScoreTable
        scoreboard={scoreboard}
        fixedInningColumns
        battingHalf={battingHalf}
        className="manager-operator-line-score"
      />
    </div>
  );
}
