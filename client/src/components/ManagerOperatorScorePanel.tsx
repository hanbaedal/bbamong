import LineScoreTable from "@/components/LineScoreTable";
import type { LiveScoreboard } from "@shared/apiSportsTypes";
import { parseInningHalf, type InningHalf } from "@shared/gamePhaseTypes";
import { resolveScoreboardInningPhase } from "@shared/matchPhaseDisplay";
import { getScoreboardDisplayTeamLabels } from "@shared/matchTeamDisplay";

interface ManagerOperatorScorePanelProps {
  scoreboard: LiveScoreboard | null;
  /** API 없을 때 운영자 DB 공수 */
  gameInning?: number | null;
  inningHalf?: string | InningHalf | null;
  matchStatus?: string;
}

function resolveBattingHalf(
  scoreboard: LiveScoreboard | null,
  gameInning?: number | null,
  inningHalf?: string | InningHalf | null,
): InningHalf | null {
  const resolved = resolveScoreboardInningPhase({
    scoreboard,
    gameInning,
    inningHalf,
  });
  if (resolved) return resolved.half;
  if (scoreboard?.inningHalf) {
    return parseInningHalf(scoreboard.inningHalf);
  }
  if (inningHalf) {
    return parseInningHalf(typeof inningHalf === "string" ? inningHalf : inningHalf);
  }
  return null;
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

  const { awayLabel, homeLabel } = getScoreboardDisplayTeamLabels(scoreboard, {
    awayFallback: "원정팀",
    homeFallback: "홈팀",
  });
  const battingHalf = resolveBattingHalf(scoreboard, gameInning, inningHalf);
  const showAttackBadge = matchStatus === "ongoing" && battingHalf != null;
  const awayBatting = showAttackBadge && battingHalf === "top";
  const homeBatting = showAttackBadge && battingHalf === "bottom";

  return (
    <div className="manager-operator-score" data-testid="manager-score-panel">
      <div className="manager-operator-score-summary">
        <div className="manager-operator-score-team manager-operator-score-team--away">
          <span className="manager-operator-score-team-name">{awayLabel}</span>
          {awayBatting && (
            <span className="manager-operator-score-phase" data-testid="manager-score-phase-away">
              공격
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
              공격
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
