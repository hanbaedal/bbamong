import type { LiveScoreboard, MatchLineupSnapshot } from "@shared/apiSportsTypes";
import { PREDICTION_AUTO_STOP_MS } from "@shared/adBreakTiming";
import { blocksAdvanceUntilResult, type AtBatPhase } from "@shared/atBatPhase";
import { findLineupBatterByName, normalizeBatterName } from "@shared/batterDisplay";
import { parseInningHalf, wrapBatterOrder, type InningHalf } from "@shared/gamePhaseTypes";
import { shouldExecutePredictionAutoStop } from "@shared/predictionAutoStop";
import {
  shouldSuggestSwitchHalf,
  shouldHoldSwitchHalfForLive,
  switchHalfHoldMessage,
  liveOutsFromScoreboard,
  liveOutsCount,
  liveHalfAlreadyStarted,
  nullableInningHalf,
  isLivePhaseBehindOperator,
  isStaleLiveThreeOutsAfterSwitch,
} from "@shared/threeOutsGuard";
import { markSwitchHalfDone, wasSwitchHalfRecent, resetSwitchHalfRecentForTest } from "./switchHalfAdGuard";
import { MatchModel, RoundStatisticsModel } from "../UserStorage/db";
import { broadcastManager } from "./broadcastManager";
import { broadcastAtBatPhase, resolveAtBatPhase } from "./atBatStateMachine";
import { stopRound } from "./predictionStorage";
import { hasRelayPitcherChangeText, getCachedRelayTexts } from "../daumLive/naverRelayClient";

/** 타자 변경 후 예측 중지까지 (수동·자동 공통 기본 8초) */
export const LIVE_AUTO_PRED_STOP_MS = Math.max(
  5_000,
  parseInt(process.env.LIVE_AUTO_PRED_STOP_MS || String(PREDICTION_AUTO_STOP_MS), 10) ||
    PREDICTION_AUTO_STOP_MS,
);
/** 타자명 깜빡임 방지 — 동일 이름 유지 후 힌트·타석종료 판정 */
export const LIVE_AUTO_BATTER_STABLE_MS = Math.max(
  1_000,
  parseInt(process.env.LIVE_AUTO_BATTER_STABLE_MS || "2000", 10) || 2_000,
);
/** 투수명 깜빡임 방지 — 텍스트 중계 확인 병행 (기존 5s → 기본 6s) */
export const LIVE_AUTO_PITCHER_STABLE_MS = Math.max(
  3_000,
  parseInt(process.env.LIVE_AUTO_PITCHER_STABLE_MS || "6000", 10) || 6_000,
);

/** 결과 대기 타임아웃 — 타석이 길어질 수 있어 기본 2분, 같은 닫힘 구간은 1회만 */
const RESULT_WATCHDOG_MS = Math.max(
  60_000,
  parseInt(process.env.LIVE_AUTO_RESULT_WATCHDOG_MS || "120000", 10) || 120_000,
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
  /** 예측 시작 시각 + 8초. 타이머 유실 시 폴링이 같은 마감을 집행 */
  autoStopDueAt: number | null;
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
  lastPitcherChangeEmitAt: number;
  resumeAfterAdBreak: boolean;
  resumeInFlight: boolean;
  adResumeTimer: NodeJS.Timeout | null;
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
      autoStopDueAt: null,
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
      lastPitcherChangeEmitAt: 0,
      resumeAfterAdBreak: false,
      resumeInFlight: false,
      adResumeTimer: null,
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

function clearScheduledAutoStop(matchId: string): void {
  const state = stateByMatch.get(matchId);
  if (!state) return;
  clearStopTimer(matchId);
  state.autoStopDueAt = null;
}

async function executeScheduledPredictionStop(
  matchId: string,
  source: string,
): Promise<void> {
  const state = getState(matchId);
  try {
    const match = await MatchModel.findOne({ id: matchId })
      .select("predictionEnabled matchStatus liveAutoEnabled")
      .lean();
    if (!match) {
      clearScheduledAutoStop(matchId);
      return;
    }
    if (match.liveAutoEnabled === false) {
      await MatchModel.updateOne({ id: matchId }, { $set: { liveAutoEnabled: true } });
    }
    const phase = await resolveAtBatPhase(matchId);
    if (!shouldExecutePredictionAutoStop({
      predictionEnabled: match.predictionEnabled,
      phase,
    })) {
      clearScheduledAutoStop(matchId);
      return;
    }
    const updated = await stopRound(matchId);
    broadcastManager.sendToMatch(matchId, "prediction_stopped", {
      matchId,
      currentRound: updated.currentRound,
      message: "실황 자동: 예측이 중지되었습니다.",
      source: "live_auto",
    });
    await emitPhaseIfChanged(matchId, "prediction_closed");
    clearScheduledAutoStop(matchId);
    console.log(`[LiveAuto] prediction stop ${matchId} (${source})`);
  } catch (error) {
    console.warn(`[LiveAuto] auto stop failed ${matchId}:`, error);
    if (!state.stopTimer) {
      state.stopTimer = setTimeout(() => {
        state.stopTimer = null;
        void executeScheduledPredictionStop(matchId, `${source}_retry`);
      }, 1_000);
    }
  }
}

async function emitPhaseIfChanged(matchId: string, phase: AtBatPhase): Promise<void> {
  const state = getState(matchId);
  if (state.lastPhaseBroadcast === phase) return;
  state.lastPhaseBroadcast = phase;
  await broadcastAtBatPhase(matchId, phase, { source: "live_auto" });
}

function clearAdResumeTimer(matchId: string): void {
  const state = stateByMatch.get(matchId);
  if (!state?.adResumeTimer) return;
  clearTimeout(state.adResumeTimer);
  state.adResumeTimer = null;
}

async function resumePredictionAfterAdBreak(
  matchId: string,
  _reason: "prediction_start" | "operator_stop" | "round_advance",
): Promise<void> {
  const state = stateByMatch.get(matchId);
  if (!state) return;
  state.resumeAfterAdBreak = false;
  state.resumeInFlight = false;
  clearAdResumeTimer(matchId);
}

/** 수동·자동 공통 — 예측 열림 후 자동 중지 타이머 */
export function schedulePredictionAutoStop(matchId: string): void {
  scheduleAutoStop(matchId);
}

function scheduleAutoStop(matchId: string): void {
  const state = getState(matchId);
  clearStopTimer(matchId);
  state.autoStopDueAt = Date.now() + LIVE_AUTO_PRED_STOP_MS;
  state.stopTimer = setTimeout(() => {
    state.stopTimer = null;
    void executeScheduledPredictionStop(matchId, "timer");
  }, LIVE_AUTO_PRED_STOP_MS);
}

async function runDuePredictionAutoStop(matchId: string, now = Date.now()): Promise<void> {
  const state = stateByMatch.get(matchId);
  if (!state?.autoStopDueAt || now < state.autoStopDueAt) return;
  await executeScheduledPredictionStop(matchId, "due");
}

async function syncPhaseFromLive(
  matchId: string,
  scoreboard: LiveScoreboard,
): Promise<void> {
  const inning = scoreboard.inning;
  const half = scoreboard.inningHalf ? parseInningHalf(scoreboard.inningHalf) : null;
  const outs = liveOutsCount(scoreboard.situation?.outs);
  const batterName = scoreboard.situation?.batterName?.trim() || "";

  const alwaysUpdate: Record<string, unknown> = {};

  const match = await MatchModel.findOne({ id: matchId })
    .select("matchLineup inningHalf outsInHalf gameInning")
    .lean();
  const operatorHalf = nullableInningHalf((match as { inningHalf?: string } | null)?.inningHalf);
  const currentOuts = (match as { outsInHalf?: number } | null)?.outsInHalf ?? 0;
  const operatorInning = (match as { gameInning?: number } | null)?.gameInning ?? null;
  const liveMovedOn = liveHalfAlreadyStarted({
    outsInHalf: currentOuts,
    liveOuts: outs,
    liveHalf: half,
    operatorHalf,
  });
  const staleThreeOuts = Boolean(half && operatorHalf && half !== operatorHalf && (outs ?? 0) >= 3);
  const liveBehind = isLivePhaseBehindOperator({
    liveHalf: half,
    operatorHalf,
    liveInning: inning,
    operatorInning,
  });
  const staleAfterSwitch =
    wasSwitchHalfRecent(matchId) &&
    isStaleLiveThreeOutsAfterSwitch({
      outsInHalf: currentOuts,
      liveOuts: outs,
      liveHalf: half,
      operatorHalf,
    });
  if (inning != null && inning > 0 && !liveBehind) alwaysUpdate.gameInning = inning;
  const phaseUpdate: Record<string, unknown> = {};
  // 광고(안내 5초 포함) 중·실황이 한 박자 뒤·교대 직후 3아웃 잔상은 초/말·아웃을 되돌리지 않는다.
  if (!broadcastManager.isAdBreakActive(matchId) && !liveBehind) {
    if (liveMovedOn && half != null && outs != null) {
      // 실황이 이미 다음 초/말(원아웃 등) — 3아웃 잔상을 지워 공수교대를 부르지 않는다.
      phaseUpdate.inningHalf = half;
      phaseUpdate.outsInHalf = outs;
    } else if (!staleThreeOuts && !staleAfterSwitch) {
      // 운영자 3아웃 동안 초/말을 실황이 덮으면, 같은 초/말로 오인되어 공수교대가 막힌다.
      if (half && currentOuts < 3) phaseUpdate.inningHalf = half;
      // 운영자 병살·삼살로 올린 아웃을 실황(늦은 2아웃)이 깎지 않는다.
      if (outs != null && outs >= currentOuts) phaseUpdate.outsInHalf = outs;
    }
  }
  const lineup = (match?.matchLineup as MatchLineupSnapshot | null) ?? null;
  if (batterName && lineup && half) {
    const side = half === "top" ? lineup.away : lineup.home;
    const found = findLineupBatterByName(side ?? [], batterName);
    if (found) alwaysUpdate.batterIndexInHalf = wrapBatterOrder(found.battingOrder);
  }

  if (Object.keys(alwaysUpdate).length > 0) {
    await MatchModel.updateOne({ id: matchId }, { $set: alwaysUpdate });
  }
  if (Object.keys(phaseUpdate).length > 0) {
    const filter: Record<string, unknown> = { id: matchId };
    if (operatorHalf) filter.inningHalf = operatorHalf;
    await MatchModel.updateOne(filter, { $set: phaseUpdate });
  }
}

async function roundNeedsResult(matchId: string, currentRound: number): Promise<boolean> {
  const stats = await RoundStatisticsModel.findOne({ matchId, roundNumber: currentRound })
    .select("isPredictionStarted isPredictionStopped isResultSent")
    .lean();
  if (!stats?.isPredictionStarted || stats.isResultSent) return false;
  return Boolean(stats.isPredictionStopped);
}

function namesEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizeBatterName(a) === normalizeBatterName(b);
}

/**
 * 실황 폴링 직후 — DB 초/말·아웃·타순 동기화 + 운영자 힌트. 진행은 수동.
 */
export async function processLiveAutoOperator(
  matchId: string,
  scoreboard: LiveScoreboard,
): Promise<void> {
  const state = getState(matchId);
  if (state.busy) return;
  state.busy = true;
  try {
    broadcastManager.enforceAdDeadlines(matchId);
    const match = await MatchModel.findOne({ id: matchId }).lean();
    if (!match) return;
    if (match.matchStatus !== "ongoing") {
      // 공수교대 직후 scheduled 깜빡임에 8초 타이머를 지우지 않는다
      await runDuePredictionAutoStop(matchId);
      return;
    }

    await syncPhaseFromLive(matchId, scoreboard);

    // 운영자 UI에 ON/OFF 없음. 예전 liveAutoEnabled=false 잔여값은 복구만 하고 진행은 수동.
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

    // — 결과 대기 watchdog: 같은 닫힘 구간 1회, 추정 결과가 있으면 긴급 토스트 생략 —
    if (phase === "prediction_closed") {
      if (!state.predictionClosedAt) state.predictionClosedAt = now;
      if (
        !state.resultWatchdogFired &&
        !suggested &&
        now - state.predictionClosedAt >= RESULT_WATCHDOG_MS
      ) {
        state.resultWatchdogFired = true;
        broadcastManager.sendToMatchStaff(matchId, "auto_result_timeout", {
          matchId,
          currentRound: match.currentRound ?? 1,
          message: "실황 결과가 아직 없습니다. 필요하면 결과를 선택해 주세요.",
          suggestedResult: situation?.suggestedResult ?? null,
        });
        console.log(`[LiveAuto] result watchdog fired ${matchId}`);
      }
    } else if (phase === "prediction_open" || phase === "result_confirmed") {
      state.predictionClosedAt = null;
      state.resultWatchdogFired = false;
    }

    const prevBatter = state.lastBatterName;
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

    const pitcherChangingNow = pitcherStableChanged && Boolean(pitcherName) && outs < 3;
    const HINT_MS = 8_000;
    const HOLD_HINT_MS = 16_000;

    // 예측 중지는 schedulePredictionAutoStop 한 루틴만 (시작 후 8초). 타석 종료로 타이머를 지우지 않는다.
    await runDuePredictionAutoStop(matchId, now);

    // —— 결과 제안만. 확정·다음타자·공수·투수·대타·예측 시작은 운영자 버튼 ——
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

    const phaseNow = await resolveAtBatPhase(matchId);

    const latestPhase = await MatchModel.findOne({ id: matchId })
      .select("outsInHalf inningHalf")
      .lean();
    const switchInput = {
      liveOuts: liveOutsFromScoreboard(scoreboard),
      outsInHalf: (latestPhase as { outsInHalf?: number } | null)?.outsInHalf ?? 0,
      liveHalf: half,
      operatorHalf:
        nullableInningHalf((latestPhase as { inningHalf?: string } | null)?.inningHalf) ?? half,
      recentlySwitched: wasSwitchHalfRecent(matchId),
    };
    const holdSwitch =
      !broadcastManager.isAdBreakActive(matchId) && shouldHoldSwitchHalfForLive(switchInput);
    const wantSwitchHint =
      !broadcastManager.isAdBreakActive(matchId) && shouldSuggestSwitchHalf(switchInput);
    if (holdSwitch && now - state.lastSwitchEmitAt >= HOLD_HINT_MS) {
      state.lastSwitchEmitAt = now;
      broadcastManager.sendToMatchStaff(matchId, "auto_action_suggested", {
        matchId,
        action: "wait_live_three_outs",
        message: switchHalfHoldMessage(switchInput.liveOuts),
        oneTapConfirm: false,
      });
    } else if (wantSwitchHint && now - state.lastSwitchEmitAt >= HINT_MS) {
      state.lastSwitchEmitAt = now;
      if (blocksAdvanceUntilResult(phaseNow) || (await roundNeedsResult(matchId, match.currentRound ?? 1))) {
        broadcastManager.sendToMatchStaff(matchId, "auto_action_blocked", {
          matchId,
          action: "switch_half",
          message: "공수교대 전 예측 결과를 입력해 주세요.",
          suggestedResult: suggested,
        });
      } else {
        broadcastManager.sendToMatchStaff(matchId, "auto_action_suggested", {
          matchId,
          action: "switch_half",
          message: "3아웃입니다. 공수교대를 눌러 주세요.",
          oneTapConfirm: true,
          suggestedResult: suggested,
        });
      }
    }

    if (pitcherChangingNow && pitcherName && now - state.lastPitcherChangeEmitAt >= HINT_MS) {
      const relayConfirmed = hasRelayPitcherChangeText(cachedRelays);
      state.lastPitcherChangeEmitAt = now;
      state.pitcherChangeSuggested = true;
      broadcastManager.sendToMatchStaff(matchId, "auto_action_suggested", {
        matchId,
        action: "pitcher_change",
        pitcherName,
        message: `투수교체 감지 — ${pitcherName}${relayConfirmed ? " (중계)" : ""}`,
        oneTapConfirm: true,
      });
    } else if (!pitcherStableChanged && state.pitcherChangeSuggested && namesEqual(pitcherName, prevPitcher)) {
      state.pitcherChangeSuggested = false;
    }

    if (batterStableChanged && batterName) {
      const lineup = (match.matchLineup as MatchLineupSnapshot | null) ?? null;
      const halfNow = parseInningHalf(match.inningHalf) ?? half;
      if (lineup && halfNow) {
        const side = halfNow === "top" ? lineup.away : lineup.home;
        const inStartingLineup = Boolean(findLineupBatterByName(side ?? [], batterName));
        if (!inStartingLineup && !namesEqual(batterName, state.lastPinchName)) {
          const idx = match.batterIndexInHalf ?? 1;
          const expected = [...(side ?? [])]
            .sort((a, b) => a.battingOrder - b.battingOrder)
            .find((row) => wrapBatterOrder(row.battingOrder) === wrapBatterOrder(idx));
          state.lastPinchName = batterName;
          broadcastManager.sendToMatchStaff(matchId, "auto_pinch_suggested", {
            matchId,
            expectedName: expected?.name ?? null,
            liveName: batterName,
            message: `대타 감지: 실황 ${batterName} — 운영자가 대타를 눌러 주세요.`,
          });
        } else if (inStartingLineup) {
          state.lastPinchName = null;
        }
      }
      if (outs < 3 && (phaseNow === "idle" || phaseNow === "result_confirmed")) {
        broadcastManager.sendToMatchStaff(matchId, "auto_action_suggested", {
          matchId,
          action: "next_batter",
          message: `다음 타자 ${batterName} — 운영자가 버튼을 눌러 주세요.`,
          oneTapConfirm: true,
        });
      }
    }

    if (batterStableChanged && batterName) {
      state.lastBatterName = batterName;
      state.pendingBatterName = batterName;
      state.pendingBatterSince = now;
    }
    if (!state.pendingBatterName || namesEqual(state.pendingBatterName, state.lastBatterName)) {
      if (batterName && !state.lastBatterName) state.lastBatterName = batterName;
    }
    state.lastOuts = outs;
    if (half) state.lastHalf = half;
    if (inning != null) state.lastInning = inning;
    if (pitcherChangingNow && pitcherName) {
      state.lastPitcherName = pitcherName;
      state.pendingPitcherName = pitcherName;
      state.pendingPitcherSince = now;
    }
    if (!state.pendingPitcherName || namesEqual(state.pendingPitcherName, state.lastPitcherName)) {
      if (pitcherName && !state.lastPitcherName) state.lastPitcherName = pitcherName;
    }
  } finally {
    state.busy = false;
  }
}

export function clearLiveAutoOperator(matchId: string): void {
  clearStopTimer(matchId);
  clearAdResumeTimer(matchId);
  resetSwitchHalfRecentForTest(matchId);
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
  if (action === "start") {
    clearStopTimer(matchId);
  }
  if (action === "stop" || action === "cancel") {
    clearScheduledAutoStop(matchId);
  }
  if (action === "result" || action === "next" || action === "switch" || action === "pitcher") {
    clearScheduledAutoStop(matchId);
    state.lastSuggestedResultKey = null;
    state.predictionClosedAt = null;
    state.resultWatchdogFired = false;
  }
  // 수동 공수교대 직후 실황 3아웃/초말 변경이 같은 교대를 재방송하지 않게
  if (action === "switch") {
    state.lastSwitchEmitAt = Date.now();
    markSwitchHalfDone(matchId);
  }
  if (action === "pitcher") {
    state.lastPitcherChangeEmitAt = Date.now();
  }
  state.lastPhaseBroadcast = null;
}

broadcastManager.onAdStopped((matchId, reason) => {
  void resumePredictionAfterAdBreak(matchId, reason);
});

/** 테스트 — 투수교체 광고 재개 상태 */
export function peekLiveAutoAdResume(matchId: string): {
  lastPitcherChangeEmitAt: number;
  resumeAfterAdBreak: boolean;
} {
  const state = stateByMatch.get(matchId);
  return {
    lastPitcherChangeEmitAt: state?.lastPitcherChangeEmitAt ?? 0,
    resumeAfterAdBreak: Boolean(state?.resumeAfterAdBreak),
  };
}
