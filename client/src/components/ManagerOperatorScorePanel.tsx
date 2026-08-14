import { useEffect, useState } from "react";
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
  controlMode?: string | null;
  /** 점수 보정 저장 — 성공 시 호출측에서 쿼리 갱신 */
  onSaveScores?: (scores: { awayScore: number; homeScore: number }) => Promise<void>;
  /** 수동 잠금 해제 — API 점수 자동 반영 */
  onResumeAuto?: () => Promise<void>;
  /** 팀명 클릭 — 시즌 성적 모달 */
  onTeamClick?: (side: "home" | "away") => void;
  /** 타순 입력/수정 */
  onLineupClick?: (side: "home" | "away") => void;
  awayLineupCount?: number;
  homeLineupCount?: number;
  awayTeamFallback?: string;
  homeTeamFallback?: string;
}

function TvScoreIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none">
      <rect x="2.5" y="4.5" width="19" height="13" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 20.5h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 17.5v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M14.6 8.2l1.2 1.2-4.1 4.1H9.4v-1.3l5.2-4z"
        fill="currentColor"
      />
    </svg>
  );
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
  controlMode,
  onSaveScores,
  onResumeAuto,
  onTeamClick,
  onLineupClick,
  awayLineupCount = 0,
  homeLineupCount = 0,
  awayTeamFallback,
  homeTeamFallback,
}: ManagerOperatorScorePanelProps) {
  const [awayScore, setAwayScore] = useState(0);
  const [homeScore, setHomeScore] = useState(0);
  const [saving, setSaving] = useState(false);

  const dirty =
    Boolean(onSaveScores) &&
    (awayScore !== (scoreboard?.awayScore ?? 0) || homeScore !== (scoreboard?.homeScore ?? 0));

  useEffect(() => {
    if (dirty) return;
    setAwayScore(scoreboard?.awayScore ?? 0);
    setHomeScore(scoreboard?.homeScore ?? 0);
  }, [scoreboard?.awayScore, scoreboard?.homeScore, scoreboard?.syncedAt, dirty]);

  const handleSave = async () => {
    if (!onSaveScores || saving) return;
    setSaving(true);
    try {
      await onSaveScores({ awayScore, homeScore });
    } finally {
      setSaving(false);
    }
  };

  if (!scoreboard && !onSaveScores) {
    return (
      <div className="manager-operator-score manager-operator-score--empty" data-testid="manager-score-panel">
        <p className="manager-operator-score-placeholder">스코어 연동 대기 중</p>
      </div>
    );
  }

  const { awayLabel, homeLabel } = getScoreboardDisplayTeamLabels(scoreboard, {
    awayFallback: awayTeamFallback?.trim() || "원정팀",
    homeFallback: homeTeamFallback?.trim() || "홈팀",
  });
  const battingHalf = resolveBattingHalf(scoreboard, gameInning, inningHalf);
  const showAttackBadge = matchStatus === "ongoing" && battingHalf != null;
  const awayBatting = showAttackBadge && battingHalf === "top";
  const homeBatting = showAttackBadge && battingHalf === "bottom";

  return (
    <div className="manager-operator-score" data-testid="manager-score-panel">
      <div className="manager-operator-score-summary">
        <div className="manager-operator-score-team manager-operator-score-team--away">
          {onTeamClick ? (
            <button
              type="button"
              className="manager-operator-score-team-name manager-operator-score-team-name--btn"
              onClick={() => onTeamClick("away")}
              data-testid="button-team-stats-away"
              title="시즌 성적"
            >
              {awayLabel}
            </button>
          ) : (
            <span className="manager-operator-score-team-name">{awayLabel}</span>
          )}
          {onLineupClick ? (
            <button
              type="button"
              className="manager-operator-score-team-lineup-hint"
              onClick={() => onLineupClick("away")}
              data-testid="button-team-lineup-away"
              title="타순 입력"
            >
              {awayLineupCount > 0 ? `타순 ${awayLineupCount}` : "타순 입력"}
            </button>
          ) : onTeamClick ? (
            <span className="manager-operator-score-team-lineup-hint">
              {awayLineupCount > 0 ? `타순 ${awayLineupCount}` : "타순 입력"}
            </span>
          ) : null}
          {awayBatting && (
            <span className="manager-operator-score-phase" data-testid="manager-score-phase-away">
              공격
            </span>
          )}
        </div>

        <div className="manager-operator-score-totals" data-testid="manager-score-totals">
          {onSaveScores ? (
            <>
              <input
                type="number"
                min={0}
                max={99}
                inputMode="numeric"
                className="manager-operator-score-input"
                value={awayScore}
                onChange={(e) => setAwayScore(Math.max(0, Math.min(99, Number(e.target.value) || 0)))}
                aria-label="원정 점수"
                data-testid="input-away-score"
              />
              <span className="manager-operator-score-colon">:</span>
              <input
                type="number"
                min={0}
                max={99}
                inputMode="numeric"
                className="manager-operator-score-input"
                value={homeScore}
                onChange={(e) => setHomeScore(Math.max(0, Math.min(99, Number(e.target.value) || 0)))}
                aria-label="홈 점수"
                data-testid="input-home-score"
              />
            </>
          ) : (
            <>
              <span>{scoreboard?.awayScore ?? 0}</span>
              <span className="manager-operator-score-colon">:</span>
              <span>{scoreboard?.homeScore ?? 0}</span>
            </>
          )}
        </div>

        <div className="manager-operator-score-team manager-operator-score-team--home">
          {homeBatting && (
            <span className="manager-operator-score-phase" data-testid="manager-score-phase-home">
              공격
            </span>
          )}
          {onTeamClick ? (
            <button
              type="button"
              className="manager-operator-score-team-name manager-operator-score-team-name--btn"
              onClick={() => onTeamClick("home")}
              data-testid="button-team-stats-home"
              title="시즌 성적"
            >
              {homeLabel}
            </button>
          ) : (
            <span className="manager-operator-score-team-name">{homeLabel}</span>
          )}
          {onLineupClick ? (
            <button
              type="button"
              className="manager-operator-score-team-lineup-hint"
              onClick={() => onLineupClick("home")}
              data-testid="button-team-lineup-home"
              title="타순 입력"
            >
              {homeLineupCount > 0 ? `타순 ${homeLineupCount}` : "타순 입력"}
            </button>
          ) : onTeamClick ? (
            <span className="manager-operator-score-team-lineup-hint">
              {homeLineupCount > 0 ? `타순 ${homeLineupCount}` : "타순 입력"}
            </span>
          ) : null}
        </div>
      </div>

      {scoreboard && (
        <LineScoreTable
          scoreboard={scoreboard}
          fixedInningColumns
          battingHalf={battingHalf}
          className="manager-operator-line-score"
        />
      )}

      {onSaveScores && (
        <div className="manager-operator-score-actions">
          <button
            type="button"
            className="manager-operator-score-icon-btn"
            disabled={!dirty || saving}
            onClick={() => void handleSave()}
            aria-label={saving ? "점수 저장 중" : "점수 보정 (TV 기준)"}
            title="점수 보정 (TV 기준)"
            data-testid="button-save-scoreboard"
          >
            <TvScoreIcon />
          </button>
          <div className="manager-operator-score-hints">
            {dirty ? (
              <span className="manager-operator-score-live-hint">
                {saving ? "저장 중…" : "저장되지 않은 수정이 있습니다. TV 아이콘을 눌러 반영하세요."}
              </span>
            ) : matchStatus === "ongoing" && controlMode !== "manual" ? (
              <span className="manager-operator-score-live-hint">
                경기 중 다음 스포츠 점수가 자동 반영됩니다. TV와 다르면 보정하세요.
              </span>
            ) : controlMode === "manual" ? (
              <span className="manager-operator-score-manual-hint">수동 잠금 — API 점수 미반영</span>
            ) : (
              <span className="manager-operator-score-live-hint">
                TV와 점수가 다르면 아이콘으로 보정하세요.
              </span>
            )}
            {controlMode === "manual" && onResumeAuto && (
              <button
                type="button"
                className="manager-operator-score-save"
                disabled={saving}
                onClick={() => void onResumeAuto()}
                data-testid="button-resume-auto-score"
              >
                API 자동 반영 켜기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
