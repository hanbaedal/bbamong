import type { LiveScoreboard, MatchLineupSnapshot } from "@shared/apiSportsTypes";
import { AD_SCHEDULE_COOLDOWN_MS, PREDICTION_AUTO_STOP_MS } from "@shared/adBreakTiming";
import { blocksAdvanceUntilResult, type AtBatPhase } from "@shared/atBatPhase";
import { findLineupBatterByName, normalizeBatterName } from "@shared/batterDisplay";
import { parseInningHalf, wrapBatterOrder, type InningHalf } from "@shared/gamePhaseTypes";
import { MatchModel, RoundStatisticsModel } from "../UserStorage/db";
import { broadcastManager } from "./broadcastManager";
import { broadcastAtBatPhase, resolveAtBatPhase } from "./atBatStateMachine";
import { buildGamePhasePayload } from "./gamePhase";
import {
  advancePitcherChange,
  advanceToNextBatter,
  advanceInningHalf,
  nextRound,
  startRound,
  stopRound,
  updateRoundPredictionResult,
} from "./predictionStorage";
import { hasRelayPitcherChangeText, getCachedRelayTexts } from "../daumLive/naverRelayClient";

/** 타자 변경 후 예측 중지까지 (수동·자동 공통 기본 8초) */
export const LIVE_AUTO_PRED_STOP_MS = Math.max(
  5_000,
  parseInt(process.env.LIVE_AUTO_PRED_STOP_MS || String(PREDICTION_AUTO_STOP_MS), 10) ||
    PREDICTION_AUTO_STOP_MS,
);
/** 타자명 깜빡임 방지 — 동일 이름 유지 후 예측 시작 (기존 3s) */
export const LIVE_AUTO_BATTER_STABLE_MS = Math.max(
  1_000,
  parseInt(process.env.LIVE_AUTO_BATTER_STABLE_MS || "2000", 10) || 2_000,
);
/** 투수명 깜빡임 방지 — 텍스트 중계 확인 병행 (기존 5s → 기본 6s) */
export const LIVE_AUTO_PITCHER_STABLE_MS = Math.max(
  3_000,
  parseInt(process.env.LIVE_AUTO_PITCHER_STABLE_MS || "6000", 10) || 6_000,
);

/** 결과 대기 타임아웃 (결과가 안 오면 운영자에게 긴급 알림) */
const RESULT_WATCHDOG_MS = Math.max(
  30_000,
  parseInt(process.env.LIVE_AUTO_RESULT_WATCHDOG_MS || "50000", 10) || 50_000,
);

type AutoState = {
  lastBatterName: string | null;
  lastOuts: number | null;
  lastHalf: InningHalf | null;
  lastInning: number | null;
  lastPitcherName: string | null;
  /** 후보 타자명(아직 확정 전) */
  pendingBatterName: string | null;
  pendingBatterSince: number | null;
  pendingPitcherName: string | null;
  pendingPitcherSince: number | null;
  stopTimer: NodeJS.Timeout | null;
  busy: boolean;
  seeded: boolean;
  lastSuggestedResultKey: string | null;
  lastSuggestedResult: string | null;
  lastAtBatResultDisplay: string | null;
  lastPhaseBroadcast: AtBatPhase | null;
  /** 투수교체 제안만 보내고 확정 대기 (텍스트 확인 안 됨) */
  pitcherChangeSuggested: boolean;
  /** 마지막으로 자동 설정한 대타명 (동일명 재브로드캐스트 방지) */
  lastPinchName: string | null;
  /** prediction_closed 진입 시각 — watchdog 용 */
  predictionClosedAt: number | null;
  resultWatchdogFired: boolean;
  /**
   * 마지막 공수교대 emit 시각.
   * 3아웃 직후 초/말 갱신으로 halfChanged가 한 번 더 오면 중복 round_next·광고를 막는다.
   */
  lastSwitchEmitAt: number;
};

const stateByMatch = new Map<string, AutoState>();

function getState(matchId: string): AutoState {
  let state = stateByMatch.get(matchId);
  if (!state) {
    state = {
      lastBatterName: null,
      lastOuts: null,
      lastHalf: null,
      lastInning: null,
      lastPitcherName: null,
      pendingBatterName: null,
      pendingBatterSince: null,
      pendingPitcherName: null,
      pendingPitcherSince: null,
      stopTimer: null,
      busy: false,
      seeded: false,
      lastSuggestedResultKey: null,
      lastSuggestedResult: null,
      lastAtBatResultDisplay: null,
      lastPhaseBroadcast: null,
      pitcherChangeSuggested: false,
      lastPinchName: null,
      predictionClosedAt: null,
      resultWatchdogFired: false,
      lastSwitchEmitAt: 0,
    };
    stateByMatch.set(matchId, state);
  }
  return state;
}

function clearStopTimer(matchId: string): void {
  const state = stateByMatch.get(matchId);
  if (!state?.stopTimer) return;
  clearTimeout(state.stopTimer);
  state.stopTimer = null;
}

async function emitPhaseIfChanged(matchId: string, phase: AtBatPhase): Promise<void> {
  const state = getState(matchId);
  if (state.lastPhaseBroadcast === phase) return;
  state.lastPhaseBroadcast = phase;
  await broadcastAtBatPhase(matchId, phase, { source: "live_auto" });
}

function scheduleAdIfAllowed(
  matchId: string,
  reason: "switch_half" | "pitcher_change",
  phase: AtBatPhase,
): void {
  if (blocksAdvanceUntilResult(phase)) {
    console.log(`[LiveAuto] ad blocked (${reason}) phase=${phase} ${matchId}`);
    return;
  }
  const now = Date.now();
  const rewardKey = `${matchId}:auto-${reason}:${now}`;
  const ok = broadcastManager.tryScheduleAdBreak(matchId, {
    rewardKey,
    reason,
  });
  if (!ok) {
    console.log(`[LiveAuto] ad skipped (${reason}) cooldown ${matchId}`);
  }
}

/** 수동·자동 공통 — 예측 열림 후 자동 중지 타이머 */
export function schedulePredictionAutoStop(matchId: string): void {
  scheduleAutoStop(matchId);
}

function scheduleAutoStop(matchId: string): void {
  clearStopTimer(matchId);
  const state = getState(matchId);
  state.stopTimer = setTimeout(() => {
    state.stopTimer = null;
    void (async () => {
      try {
        const match = await MatchModel.findOne({ id: matchId })
          .select("predictionEnabled matchStatus liveAutoEnabled")
          .lean();
        if (!match) return;
        // 토글 UI 없음 — 예전 OFF 잔여값은 복구한 뒤 계속 진행
        if (match.liveAutoEnabled === false) {
          await MatchModel.updateOne({ id: matchId }, { $set: { liveAutoEnabled: true } });
        }
        if (!match.predictionEnabled || match.matchStatus !== "ongoing") return;
        const phase = await resolveAtBatPhase(matchId);
        if (phase !== "prediction_open") return;
        const updated = await stopRound(matchId);
        broadcastManager.sendToMatch(matchId, "prediction_stopped", {
          matchId,
          currentRound: updated.currentRound,
          message: "실황 자동: 예측이 중지되었습니다.",
          source: "live_auto",
        });
        await emitPhaseIfChanged(matchId, "prediction_closed");
        console.log(`[LiveAuto] prediction stop ${matchId}`);
      } catch (error) {
        console.warn(`[LiveAuto] auto stop failed ${matchId}:`, error);
      }
    })();
  }, LIVE_AUTO_PRED_STOP_MS);
}

async function syncPhaseFromLive(
  matchId: string,
  scoreboard: LiveScoreboard,
): Promise<void> {
  const inning = scoreboard.inning;
  const half = scoreboard.inningHalf ? parseInningHalf(scoreboard.inningHalf) : null;
  const outs = Math.min(3, Math.max(0, scoreboard.situation?.outs ?? 0));
  const batterName = scoreboard.situation?.batterName?.trim() || "";

  const update: Record<string, unknown> = { outsInHalf: outs };
  if (inning != null && inning > 0) update.gameInning = inning;
  if (half) update.inningHalf = half;

  const match = await MatchModel.findOne({ id: matchId })
    .select("matchLineup")
    .lean();
  const lineup = (match?.matchLineup as MatchLineupSnapshot | null) ?? null;
  if (batterName && lineup && half) {
    const side = half === "top" ? lineup.away : lineup.home;
    const found = findLineupBatterByName(side ?? [], batterName);
    if (found) update.batterIndexInHalf = wrapBatterOrder(found.battingOrder);
  }

  await MatchModel.updateOne({ id: matchId }, { $set: update });
}

async function roundNeedsResult(matchId: string, currentRound: number): Promise<boolean> {
  const stats = await RoundStatisticsModel.findOne({ matchId, roundNumber: currentRound })
    .select("isPredictionStarted isPredictionStopped isResultSent")
    .lean();
  if (!stats?.isPredictionStarted || stats.isResultSent) return false;
  return Boolean(stats.isPredictionStopped);
}

async function autoSettleRoundResult(
  matchId: string,
  result: string,
  displayResult?: string | null,
): Promise<boolean> {
  const match = await MatchModel.findOne({ id: matchId }).select("currentRound").lean();
  if (!match) return false;
  const round = match.currentRound ?? 1;
  if (!(await roundNeedsResult(matchId, round))) return false;
  try {
    const userWonAmounts = await updateRoundPredictionResult(matchId, round, result);
    const userDataMap = new Map<string, { wonAmount: number }>();
    userWonAmounts.forEach((wonAmount, userId) => {
      userDataMap.set(userId, { wonAmount });
    });
    const shown = (displayResult ?? "").trim() || result;
    broadcastManager.sendToMatchWithUserData(
      matchId,
      "round_result",
      {
        matchId,
        roundNumber: round,
        result,
        displayResult: shown,
        source: "live_auto",
        message: `실황 자동 결과: ${shown}`,
      },
      userDataMap,
    );
    await emitPhaseIfChanged(matchId, "result_confirmed");
    console.log(`[LiveAuto] auto result ${matchId} ${result} display=${shown}`);
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("이미 전송")) {
      await emitPhaseIfChanged(matchId, "result_confirmed");
      return true;
    }
    console.warn(`[LiveAuto] auto result failed ${matchId}:`, error);
    return false;
  }
}

async function emitPhaseSnapshot(
  matchId: string,
  advanceType: "next_batter" | "switch_half" | "pitcher_change",
  message: string,
  skippedResult = false,
): Promise<void> {
  const match = await MatchModel.findOne({ id: matchId }).lean();
  if (!match) return;
  const gamePhase = buildGamePhasePayload(match as never);
  broadcastManager.sendToMatch(matchId, "round_next", {
    matchId,
    currentRound: match.currentRound,
    predictionEnabled: match.predictionEnabled,
    advanceType,
    gamePhase,
    skippedResult,
    message,
    source: "live_auto",
  });
  await emitPhaseIfChanged(matchId, "idle");
}

async function stopPredictionIfOpen(matchId: string, reason: string): Promise<void> {
  const match = await MatchModel.findOne({ id: matchId }).select("predictionEnabled").lean();
  if (!match?.predictionEnabled) return;
  const updated = await stopRound(matchId);
  // 단계 방송을 이벤트보다 먼저 — 클라가 uiStage 권위로 wait_result 고정
  await emitPhaseIfChanged(matchId, "prediction_closed");
  broadcastManager.sendToMatch(matchId, "prediction_stopped", {
    matchId,
    currentRound: updated.currentRound,
    message: reason,
    source: "live_auto",
  });
}

async function startPredictionForBatter(matchId: string, batterName: string): Promise<void> {
  const state = getState(matchId);
  state.lastSuggestedResult = null;
  state.lastAtBatResultDisplay = null;
  state.lastSuggestedResultKey = null;
  broadcastManager.clearAdTimer(matchId);
  if (broadcastManager.isAdPlaying(matchId)) {
    broadcastManager.stopAdPlaying(matchId, "prediction_start", "예측 시작으로 광고가 중지되었습니다.");
  }
  const started = await startRound(matchId);
  await emitPhaseIfChanged(matchId, "prediction_open");
  broadcastManager.sendToMatch(matchId, "prediction_started", {
    matchId,
    currentRound: started.currentRound,
    message: `실황 자동 예측 시작 — ${batterName}`,
    source: "live_auto",
  });
  scheduleAutoStop(matchId);
  console.log(`[LiveAuto] prediction start ${matchId} batter=${batterName}`);
}

function namesEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizeBatterName(a) === normalizeBatterName(b);
}

/**
 * 실황 폴링 직후 — DB 초/말·아웃·타순 동기화 + 상태머신 허용 전이만 수행.
 */
export async function processLiveAutoOperator(
  matchId: string,
  scoreboard: LiveScoreboard,
): Promise<void> {
  const state = getState(matchId);
  if (state.busy) return;
  state.busy = true;
  try {
    const match = await MatchModel.findOne({ id: matchId }).lean();
    if (!match) return;
    if (match.matchStatus !== "ongoing") {
      clearStopTimer(matchId);
      return;
    }

    await syncPhaseFromLive(matchId, scoreboard);

    // 운영자 UI에 ON/OFF 없음 — 하이브리드만. 예전 OFF 잔여값은 자동 복구.
    if (match.liveAutoEnabled === false) {
      await MatchModel.updateOne({ id: matchId }, { $set: { liveAutoEnabled: true } });
    }

    const situation = scoreboard.situation;
    const batterName = situation?.batterName?.trim() || "";
    const pitcherName = situation?.pitcherName?.trim() || "";
    const outs = situation?.outs ?? 0;
    const half = scoreboard.inningHalf ? parseInningHalf(scoreboard.inningHalf) : null;
    const inning = scoreboard.inning ?? null;
    const suggested = situation?.suggestedResult ?? null;
    const now = Date.now();

    // 첫 틱은 기준선만 잡고 액션하지 않음
    if (!state.seeded) {
      state.seeded = true;
      state.lastBatterName = batterName || null;
      state.lastOuts = outs;
      state.lastHalf = half;
      state.lastInning = inning;
      state.lastPitcherName = pitcherName || null;
      const phase = await resolveAtBatPhase(matchId);
      await emitPhaseIfChanged(matchId, phase);
      return;
    }

    const phase = await resolveAtBatPhase(matchId);
    await emitPhaseIfChanged(matchId, phase);

    // — 결과 대기 watchdog: prediction_closed 상태가 오래 지속되면 운영자에게 긴급 알림 —
    if (phase === "prediction_closed") {
      if (!state.predictionClosedAt) state.predictionClosedAt = now;
      if (
        !state.resultWatchdogFired &&
        now - state.predictionClosedAt >= RESULT_WATCHDOG_MS
      ) {
        state.resultWatchdogFired = true;
        broadcastManager.sendToMatchStaff(matchId, "auto_result_timeout", {
          matchId,
          currentRound: match.currentRound ?? 1,
          message: "결과가 감지되지 않습니다. 수동으로 결과를 입력해 주세요.",
          suggestedResult: situation?.suggestedResult ?? null,
        });
        console.log(`[LiveAuto] result watchdog fired ${matchId}`);
      }
    } else {
      state.predictionClosedAt = null;
      state.resultWatchdogFired = false;
    }

    const prevBatter = state.lastBatterName;
    const prevOuts = state.lastOuts;
    const prevHalf = state.lastHalf;
    const prevInning = state.lastInning;
    const prevPitcher = state.lastPitcherName;

    // —— 타자명 안정화 가드 ——
    let batterStableChanged = false;
    if (batterName) {
      if (!namesEqual(batterName, state.pendingBatterName)) {
        state.pendingBatterName = batterName;
        state.pendingBatterSince = now;
      } else if (
        state.pendingBatterSince != null &&
        now - state.pendingBatterSince >= LIVE_AUTO_BATTER_STABLE_MS &&
        !namesEqual(batterName, prevBatter)
      ) {
        batterStableChanged = Boolean(prevBatter);
      }
    }

    // —— 투수명 안정화 가드 ——
    let pitcherStableChanged = false;
    if (pitcherName) {
      if (!namesEqual(pitcherName, state.pendingPitcherName)) {
        state.pendingPitcherName = pitcherName;
        state.pendingPitcherSince = now;
      } else if (
        state.pendingPitcherSince != null &&
        now - state.pendingPitcherSince >= LIVE_AUTO_PITCHER_STABLE_MS &&
        !namesEqual(pitcherName, prevPitcher)
      ) {
        pitcherStableChanged = Boolean(prevPitcher);
      }
    }

    const outsHitThree = prevOuts != null && prevOuts < 3 && outs >= 3;
    const outsIncreased = prevOuts != null && outs > prevOuts;
    const halfChanged =
      half != null &&
      prevHalf != null &&
      (half !== prevHalf || (inning != null && prevInning != null && inning !== prevInning));
    const cachedRelays = getCachedRelayTexts(
      (match as { daumGameId?: number | null }).daumGameId != null
        ? String((match as { daumGameId?: number | null }).daumGameId)
        : null,
    );

    const displayLabel = situation?.atBatResultDisplay?.trim() || null;
    if (suggested) {
      state.lastSuggestedResult = suggested;
      state.lastAtBatResultDisplay = displayLabel || state.lastAtBatResultDisplay;
    } else if (displayLabel) {
      state.lastAtBatResultDisplay = displayLabel;
    }

    const playEnded = outsIncreased || halfChanged || batterStableChanged;
    const pitcherChangingNow = pitcherStableChanged && Boolean(pitcherName) && outs < 3;
    // 3아웃·공수교대는 결과 정산을 먼저. 그 외 투수교체는 환불·스킵이 우선.
    const deferSettleForPitcher = pitcherChangingNow && !outsHitThree && !halfChanged;

    if (playEnded && phase === "prediction_open" && !deferSettleForPitcher) {
      clearStopTimer(matchId);
      await stopPredictionIfOpen(matchId, "실황 자동: 타석 종료로 예측 중지");
    }

    // —— 실황 결과 자동 확정 (운영자 1탭 없이도 타격 결과가 반드시 나감) ——
    if (playEnded && !deferSettleForPitcher) {
      const settleCandidate = suggested || state.lastSuggestedResult;
      if (settleCandidate) {
        const closedPhase = await resolveAtBatPhase(matchId);
        if (closedPhase === "prediction_closed") {
          const settled = await autoSettleRoundResult(
            matchId,
            settleCandidate,
            displayLabel || state.lastAtBatResultDisplay,
          );
          if (settled) {
            state.lastSuggestedResult = null;
            state.lastSuggestedResultKey = null;
          }
        }
      }
    }

    // —— 결과 제안 (자동 확정 실패·애매한 경우 운영자 1탭) ——
    if (suggested && (await resolveAtBatPhase(matchId)) === "prediction_closed") {
      const round = match.currentRound ?? 1;
      const key = `${round}:${suggested}:${batterName || prevBatter || ""}`;
      if (await roundNeedsResult(matchId, round)) {
        if (state.lastSuggestedResultKey !== key) {
          state.lastSuggestedResultKey = key;
          broadcastManager.sendToMatchStaff(matchId, "auto_result_suggested", {
            matchId,
            currentRound: round,
            suggestedResult: suggested,
            batterName: batterName || prevBatter,
            message: `실황 추정 결과: ${suggested}`,
            oneTapConfirm: true,
          });
        }
      }
    }

    // —— 공수교대 (idle | result_confirmed만 — 결과 미전송이면 절대 emit 하지 않음) ——
    // 성공·차단 모두 이 tick에서는 투수/타자 전이로 이어가지 않음 (광고·연출 겹침 방지)
    if (halfChanged || outsHitThree) {
      // 3아웃 emit 직후 실황 초/말만 바뀌는 틱 — 동일 교대를 다시 방송하지 않음
      if (now - state.lastSwitchEmitAt < AD_SCHEDULE_COOLDOWN_MS) {
        state.lastOuts = outs;
        if (half) state.lastHalf = half;
        if (inning != null) state.lastInning = inning;
        // 성공한 공수교대와 같이 이 tick에서는 다른 전이로 이어가지 않음
        return;
      }

      let switchHandled = false;
      try {
        await stopPredictionIfOpen(matchId, "실황 자동: 공수교대 전 예측 중지");
        const fresh = await MatchModel.findOne({ id: matchId }).lean();
        if (!fresh) {
          /* skip */
        } else {
          const round = fresh.currentRound ?? 1;
          let p = await resolveAtBatPhase(matchId);

          if (blocksAdvanceUntilResult(p)) {
            broadcastManager.sendToMatchStaff(matchId, "auto_action_blocked", {
              matchId,
              action: "switch_half",
              message: "공수교대 전 예측 결과를 입력해 주세요.",
              suggestedResult: suggested,
            });
            switchHandled = true;
          } else if (await roundNeedsResult(matchId, round)) {
            broadcastManager.sendToMatchStaff(matchId, "auto_action_blocked", {
              matchId,
              action: "switch_half",
              message: "공수교대 전 예측 결과를 입력해 주세요.",
              suggestedResult: suggested,
            });
            console.log(`[LiveAuto] switch half blocked (needs result) ${matchId}`);
            switchHandled = true;
          } else {
            const stats = await RoundStatisticsModel.findOne({ matchId, roundNumber: round })
              .select("isResultSent isPredictionStarted")
              .lean();
            try {
              if (stats?.isResultSent || p === "result_confirmed") {
                await advanceInningHalf(matchId);
              } else if (!stats) {
                // 이 타석에 예측이 없었음 — 실황 초/말만 이미 sync됨, 라운드 bump 없이 UI 통지
              } else {
                await nextRound(matchId);
                await syncPhaseFromLive(matchId, scoreboard);
              }
              await emitPhaseSnapshot(matchId, "switch_half", "실황 자동 공수교대");
              state.lastSwitchEmitAt = now;
              scheduleAdIfAllowed(matchId, "switch_half", "idle");
              console.log(`[LiveAuto] switch half ${matchId}`);
              switchHandled = true;
            } catch (advanceErr) {
              console.warn(`[LiveAuto] switch half advance failed ${matchId}:`, advanceErr);
              broadcastManager.sendToMatchStaff(matchId, "auto_action_blocked", {
                matchId,
                action: "switch_half",
                message:
                  advanceErr instanceof Error
                    ? advanceErr.message
                    : "공수교대 전 예측 결과를 입력해 주세요.",
                suggestedResult: suggested,
              });
              switchHandled = true;
            }
          }
        }
      } catch (error) {
        console.warn(`[LiveAuto] switch half failed ${matchId}:`, error);
        switchHandled = true;
      }

      if (switchHandled) {
        if (batterStableChanged && batterName) {
          state.lastBatterName = batterName;
          state.pendingBatterName = batterName;
          state.pendingBatterSince = now;
        }
        // 투수명은 기준만 맞추지 않음 — 공수 다음 tick에서 필요 시 교체 처리
        state.lastOuts = outs;
        if (half) state.lastHalf = half;
        if (inning != null) state.lastInning = inning;
        return;
      }
    }

    // —— 투수 교체: 투수명 안정화 후 자동 확정 (운영자 1탭 불필요). 중계 문구는 로그용. ——
    // 3아웃·공수 우선. 성공 시 같은 tick에서 타자/예측 시작으로 이어가지 않음.
    if (pitcherChangingNow && pitcherName) {
      const relayConfirmed = hasRelayPitcherChangeText(cachedRelays);
      try {
        const { skippedResult } = await advancePitcherChange(matchId);
        await syncPhaseFromLive(matchId, scoreboard);
        await emitPhaseSnapshot(
          matchId,
          "pitcher_change",
          `실황 자동 투수교체 — ${pitcherName}`,
          skippedResult,
        );
        scheduleAdIfAllowed(matchId, "pitcher_change", "idle");
        state.lastPitcherName = pitcherName;
        state.pendingPitcherName = pitcherName;
        state.pendingPitcherSince = now;
        state.pitcherChangeSuggested = false;
        if (batterStableChanged && batterName) {
          state.lastBatterName = batterName;
          state.pendingBatterName = batterName;
          state.pendingBatterSince = now;
        }
        state.lastOuts = outs;
        if (half) state.lastHalf = half;
        if (inning != null) state.lastInning = inning;
        console.log(
          `[LiveAuto] pitcher change ${matchId} → ${pitcherName}${relayConfirmed ? " (relay)" : ""}`,
        );
        return;
      } catch (error) {
        console.warn(`[LiveAuto] pitcher change failed ${matchId}:`, error);
        if (!state.pitcherChangeSuggested) {
          state.pitcherChangeSuggested = true;
          broadcastManager.sendToMatchStaff(matchId, "auto_action_suggested", {
            matchId,
            action: "pitcher_change",
            pitcherName,
            message: `투수교체 감지 — ${pitcherName} (자동 확정 실패, 1탭 확정)`,
            oneTapConfirm: true,
          });
        }
      }
    } else if (!pitcherStableChanged && state.pitcherChangeSuggested && namesEqual(pitcherName, prevPitcher)) {
      state.pitcherChangeSuggested = false;
    }

    // 결과 대기 중이면 다음타자·광고 금지 (투수교체는 위에서 처리)
    const phaseAfterResult = await resolveAtBatPhase(matchId);
    if (blocksAdvanceUntilResult(phaseAfterResult)) {
      if (batterStableChanged && phaseAfterResult === "prediction_open" && outs < 3) {
        clearStopTimer(matchId);
        await stopPredictionIfOpen(matchId, "실황 자동: 타자 변경으로 예측 중지");
        broadcastManager.sendToMatchStaff(matchId, "auto_action_blocked", {
          matchId,
          action: "next_batter",
          message: "다음 타자 전 예측 결과를 입력해 주세요.",
          suggestedResult: suggested,
        });
      }

      if (batterStableChanged && batterName) {
        state.lastBatterName = batterName;
        state.pendingBatterName = batterName;
        state.pendingBatterSince = now;
      }
      state.lastOuts = outs;
      if (half) state.lastHalf = half;
      if (inning != null) state.lastInning = inning;
      return;
    }

    // —— 타자 변경 → 다음타자 + 예측 시작 (idle | result_confirmed) ——
    const phaseForBatter = await resolveAtBatPhase(matchId);
    if (
      batterStableChanged &&
      outs < 3 &&
      !blocksAdvanceUntilResult(phaseForBatter) &&
      batterName
    ) {
      try {
        clearStopTimer(matchId);
        await stopPredictionIfOpen(matchId, "실황 자동: 타자 변경으로 예측 중지");

        let current = await MatchModel.findOne({ id: matchId }).lean();
        if (!current) return;
        const round = current.currentRound ?? 1;
        const p = await resolveAtBatPhase(matchId);

        if (blocksAdvanceUntilResult(p)) {
          broadcastManager.sendToMatchStaff(matchId, "auto_action_blocked", {
            matchId,
            action: "next_batter",
            message: "다음 타자 전 예측 결과를 입력해 주세요.",
            suggestedResult: suggested,
          });
        } else {
          const stats = await RoundStatisticsModel.findOne({ matchId, roundNumber: round })
            .select("isResultSent isPredictionStarted")
            .lean();
          let advancedOk = true;
          if (stats?.isResultSent || phaseForBatter === "result_confirmed") {
            try {
              await advanceToNextBatter(matchId);
              await syncPhaseFromLive(matchId, scoreboard);
              await emitPhaseSnapshot(matchId, "next_batter", `실황 자동 다음 타자 — ${batterName}`);
            } catch (advanceErr) {
              advancedOk = false;
              console.warn(`[LiveAuto] next batter advance failed ${matchId}:`, advanceErr);
              broadcastManager.sendToMatchStaff(matchId, "auto_action_blocked", {
                matchId,
                action: "next_batter",
                message:
                  advanceErr instanceof Error
                    ? advanceErr.message
                    : "다음 타자 전 예측 결과를 입력해 주세요.",
                suggestedResult: suggested,
              });
            }
          }

          if (advancedOk) {
            current = await MatchModel.findOne({ id: matchId }).lean();
            const lineup = (current?.matchLineup as MatchLineupSnapshot | null) ?? null;
            const halfNow = parseInningHalf(current?.inningHalf) ?? half;
            if (lineup && halfNow && batterName && current) {
              const side = halfNow === "top" ? lineup.away : lineup.home;
              const idx = current.batterIndexInHalf ?? 1;
              const expected = [...(side ?? [])]
                .sort((a, b) => a.battingOrder - b.battingOrder)
                .find((row) => wrapBatterOrder(row.battingOrder) === wrapBatterOrder(idx));
              // 대타 = 실황 타자가 선발 타순에 없을 때만 (슬롯 불일치만으로는 대타 아님)
              const inStartingLineup = Boolean(
                findLineupBatterByName(side ?? [], batterName),
              );
              if (!inStartingLineup && !namesEqual(batterName, state.lastPinchName)) {
                broadcastManager.sendToMatchStaff(matchId, "auto_pinch_suggested", {
                  matchId,
                  expectedName: expected?.name ?? null,
                  liveName: batterName,
                  message: `대타: 실황 ${batterName}`,
                });
                try {
                  const { setMatchPinchHitter } = await import("../apiSports/pinchHitterService");
                  const pinch = await setMatchPinchHitter(matchId, { playerName: batterName });
                  state.lastPinchName = batterName;
                  broadcastManager.sendToMatch(matchId, "pinch_hitter_set", {
                    matchId,
                    pinchHitter: pinch,
                    message: `대타 ${batterName}`,
                    source: "live_auto",
                  });
                } catch (pinchErr) {
                  console.warn(`[LiveAuto] pinch set failed ${matchId}:`, pinchErr);
                }
              } else if (inStartingLineup) {
                state.lastPinchName = null;
              }
            }

            const startPhase = await resolveAtBatPhase(matchId);
            if (startPhase === "idle") {
              await startPredictionForBatter(matchId, batterName);
            } else {
              console.log(
                `[LiveAuto] skip prediction start phase=${startPhase} ${matchId} batter=${batterName}`,
              );
            }
          }

          state.lastBatterName = batterName;
          state.pendingBatterName = batterName;
          state.pendingBatterSince = now;
        }
      } catch (error) {
        console.warn(`[LiveAuto] batter change flow failed ${matchId}:`, error);
      }
    }

    // 기준선 갱신 (아직 안정화되지 않은 이름은 last에 올리지 않음)
    if (!state.pendingBatterName || namesEqual(state.pendingBatterName, state.lastBatterName)) {
      if (batterName && !state.lastBatterName) state.lastBatterName = batterName;
    }
    state.lastOuts = outs;
    if (half) state.lastHalf = half;
    if (inning != null) state.lastInning = inning;
    if (!state.pendingPitcherName || namesEqual(state.pendingPitcherName, state.lastPitcherName)) {
      if (pitcherName && !state.lastPitcherName) state.lastPitcherName = pitcherName;
    }
  } finally {
    state.busy = false;
  }
}

export function clearLiveAutoOperator(matchId: string): void {
  clearStopTimer(matchId);
  stateByMatch.delete(matchId);
  // 열려 있는 예측을 닫아 영구 OPEN 방지
  void (async () => {
    try {
      const match = await MatchModel.findOne({ id: matchId }).select("predictionEnabled").lean();
      if (match?.predictionEnabled) {
        const updated = await stopRound(matchId);
        broadcastManager.sendToMatch(matchId, "prediction_stopped", {
          matchId,
          currentRound: updated.currentRound,
          message: "실황 연동 해제: 예측이 중지되었습니다.",
          source: "live_auto",
        });
        console.log(`[LiveAuto] clear: stopped open prediction ${matchId}`);
      }
    } catch (e) {
      console.warn(`[LiveAuto] clear-time stop failed ${matchId}:`, e);
    }
  })();
}

/** 수동 오버라이드 시 타이머·후보 초기화 */
export function notifyManualAtBatAction(
  matchId: string,
  action: "start" | "stop" | "result" | "next" | "switch" | "pitcher" | "cancel",
): void {
  const state = getState(matchId);
  if (action === "start" || action === "stop" || action === "cancel") {
    clearStopTimer(matchId);
  }
  if (action === "result" || action === "next" || action === "switch" || action === "pitcher") {
    clearStopTimer(matchId);
    state.lastSuggestedResultKey = null;
  }
  // 수동 공수교대 직후 실황 3아웃/초말 변경이 같은 교대를 재방송하지 않게
  if (action === "switch") {
    state.lastSwitchEmitAt = Date.now();
  }
  state.lastPhaseBroadcast = null;
}
