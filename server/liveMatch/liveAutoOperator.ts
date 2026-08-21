import type {
  LiveScoreboard,
  LiveSuggestedPredictionResult,
  MatchLineupSnapshot,
} from "@shared/apiSportsTypes";
import { PREDICTION_AUTO_STOP_MS } from "@shared/adBreakTiming";
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
  incrementOutsInHalfOnResult,
  nextRound,
  startRound,
  stopRound,
  updateRoundPredictionResult,
} from "./predictionStorage";
import { hasRelayPitcherChangeText, hasRelayDoublePlays, getCachedRelayTexts } from "../daumLive/naverRelayClient";

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
  lastPhaseBroadcast: AtBatPhase | null;
  /** 투수교체 제안만 보내고 확정 대기 (텍스트 확인 안 됨) */
  pitcherChangeSuggested: boolean;
  /** 마지막으로 자동 설정한 대타명 (동일명 재브로드캐스트 방지) */
  lastPinchName: string | null;
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
      lastPhaseBroadcast: null,
      pitcherChangeSuggested: false,
      lastPinchName: null,
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

async function tryApplySuggestedResult(
  matchId: string,
  currentRound: number,
  suggested: LiveSuggestedPredictionResult,
  options?: { isDoublePlay?: boolean },
): Promise<boolean> {
  try {
    if (!(await roundNeedsResult(matchId, currentRound))) return false;
    const userWonAmounts = await updateRoundPredictionResult(matchId, currentRound, suggested);
    await incrementOutsInHalfOnResult(matchId, suggested, { isDoublePlay: options?.isDoublePlay });
    const userDataMap = new Map<string, { wonAmount: number }>();
    userWonAmounts.forEach((wonAmount, userId) => {
      userDataMap.set(userId, { wonAmount });
    });
    broadcastManager.sendToMatchWithUserData(
      matchId,
      "round_result",
      {
        matchId,
        roundNumber: currentRound,
        result: suggested,
        message: `실황 자동 결과: ${suggested}`,
        source: "live_auto",
      },
      userDataMap,
    );
    await emitPhaseIfChanged(matchId, "result_confirmed");
    console.log(`[LiveAuto] auto result ${matchId} → ${suggested}`);
    return true;
  } catch (error) {
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
  broadcastManager.sendToMatch(matchId, "prediction_stopped", {
    matchId,
    currentRound: updated.currentRound,
    message: reason,
    source: "live_auto",
  });
  await emitPhaseIfChanged(matchId, "prediction_closed");
}

async function startPredictionForBatter(matchId: string, batterName: string): Promise<void> {
  broadcastManager.clearAdTimer(matchId);
  if (broadcastManager.isAdPlaying(matchId)) {
    broadcastManager.stopAdPlaying(matchId, "prediction_start", "예측 시작으로 광고가 중지되었습니다.");
  }
  const started = await startRound(matchId);
  broadcastManager.sendToMatch(matchId, "prediction_started", {
    matchId,
    currentRound: started.currentRound,
    message: `실황 자동 예측 시작 — ${batterName}`,
    source: "live_auto",
  });
  await emitPhaseIfChanged(matchId, "prediction_open");
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
    const halfChanged =
      half != null &&
      prevHalf != null &&
      (half !== prevHalf || (inning != null && prevInning != null && inning !== prevInning));
    const cachedRelays = getCachedRelayTexts((match as any).daumGameId);
    const isDoublePlay =
      (suggested === "아웃" && prevOuts != null && outs - prevOuts >= 2) ||
      hasRelayDoublePlays(cachedRelays);

    // —— 결과 제안 / 이중조건 자동 확정 (prediction_closed만) ——
    if (suggested && phase === "prediction_closed") {
      const round = match.currentRound ?? 1;
      const key = `${round}:${suggested}:${batterName || prevBatter || ""}`;
      if (await roundNeedsResult(matchId, round)) {
        if (state.lastSuggestedResultKey !== key) {
          state.lastSuggestedResultKey = key;
          broadcastManager.sendToMatch(matchId, "auto_result_suggested", {
            matchId,
            currentRound: round,
            suggestedResult: suggested,
            batterName: batterName || prevBatter,
            message: `실황 추정 결과: ${suggested}`,
            oneTapConfirm: true,
          });
        }
        const canAutoOut = suggested === "아웃" && prevOuts != null && outs > prevOuts;
        const canAutoExtraBase =
          (suggested === "홈런" ||
            suggested === "2루" ||
            suggested === "3루" ||
            suggested === "1루") &&
          batterStableChanged &&
          prevOuts != null &&
          outs === prevOuts;
        // 공수교대 직전(3아웃·초말변경)이면 추정 결과를 우선 확정해 대기 고착을 막는다
        const mustResolveBeforeSwitch = halfChanged || outsHitThree;
        if (canAutoOut || canAutoExtraBase || mustResolveBeforeSwitch) {
          await tryApplySuggestedResult(matchId, round, suggested, { isDoublePlay });
        }
      }
    }

    // 예측 열림 중 3아웃/초말 변경 → 먼저 중지해 결과 대기로 전환
    if ((halfChanged || outsHitThree) && phase === "prediction_open") {
      clearStopTimer(matchId);
      await stopPredictionIfOpen(matchId, "실황 자동: 공수교대 전 예측 중지");
      if (suggested) {
        const round = match.currentRound ?? 1;
        await tryApplySuggestedResult(matchId, round, suggested, { isDoublePlay });
      }
    }

    // —— 공수교대 (idle | result_confirmed만 — 결과 미전송이면 절대 emit 하지 않음) ——
    // 성공·차단 모두 이 tick에서는 투수/타자 전이로 이어가지 않음 (광고·연출 겹침 방지)
    if (halfChanged || outsHitThree) {
      let switchHandled = false;
      try {
        await stopPredictionIfOpen(matchId, "실황 자동: 공수교대 전 예측 중지");
        const fresh = await MatchModel.findOne({ id: matchId }).lean();
        if (!fresh) {
          /* skip */
        } else {
          const round = fresh.currentRound ?? 1;
          let p = await resolveAtBatPhase(matchId);

          if (blocksAdvanceUntilResult(p) && suggested) {
            await tryApplySuggestedResult(matchId, round, suggested, { isDoublePlay });
            p = await resolveAtBatPhase(matchId);
          }

          if (blocksAdvanceUntilResult(p)) {
            broadcastManager.sendToMatch(matchId, "auto_action_blocked", {
              matchId,
              action: "switch_half",
              message: "공수교대 전 예측 결과를 입력해 주세요.",
              suggestedResult: suggested,
            });
            switchHandled = true;
          } else if (await roundNeedsResult(matchId, round)) {
            broadcastManager.sendToMatch(matchId, "auto_action_blocked", {
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
              scheduleAdIfAllowed(matchId, "switch_half", "idle");
              console.log(`[LiveAuto] switch half ${matchId}`);
              switchHandled = true;
            } catch (advanceErr) {
              console.warn(`[LiveAuto] switch half advance failed ${matchId}:`, advanceErr);
              broadcastManager.sendToMatch(matchId, "auto_action_blocked", {
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

    // —— 투수 교체: 텍스트 중계 확인 후 자동 확정, 미확인이면 제안만 ——
    // 3아웃·공수 우선. 성공 시 같은 tick에서 타자/예측 시작으로 이어가지 않음.
    if (pitcherStableChanged && outs < 3 && pitcherName) {
      const relayConfirmed = hasRelayPitcherChangeText(cachedRelays);
      if (relayConfirmed) {
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
          console.log(`[LiveAuto] pitcher change (relay confirmed) ${matchId} → ${pitcherName}`);
          return;
        } catch (error) {
          console.warn(`[LiveAuto] pitcher change failed ${matchId}:`, error);
        }
      } else if (!state.pitcherChangeSuggested) {
        state.pitcherChangeSuggested = true;
        broadcastManager.sendToMatch(matchId, "auto_action_suggested", {
          matchId,
          action: "pitcher_change",
          pitcherName,
          message: `투수교체 감지 — ${pitcherName} (중계 텍스트 미확인, 1탭 확정)`,
          oneTapConfirm: true,
        });
        console.log(`[LiveAuto] pitcher change suggested (no relay text) ${matchId} → ${pitcherName}`);
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
        broadcastManager.sendToMatch(matchId, "auto_action_blocked", {
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
          broadcastManager.sendToMatch(matchId, "auto_action_blocked", {
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
              broadcastManager.sendToMatch(matchId, "auto_action_blocked", {
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
                broadcastManager.sendToMatch(matchId, "auto_pinch_suggested", {
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
  state.lastPhaseBroadcast = null;
}
