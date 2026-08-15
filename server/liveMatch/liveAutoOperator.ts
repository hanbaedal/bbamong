import type {
  LiveScoreboard,
  LiveSuggestedPredictionResult,
  MatchLineupSnapshot,
} from "@shared/apiSportsTypes";
import { findLineupBatterByName, normalizeBatterName } from "@shared/batterDisplay";
import { parseInningHalf, wrapBatterOrder, type InningHalf } from "@shared/gamePhaseTypes";
import { MatchModel, RoundStatisticsModel } from "../UserStorage/db";
import { broadcastManager } from "./broadcastManager";
import { buildGamePhasePayload } from "./gamePhase";
import {
  advancePitcherChange,
  advanceToNextBatter,
  incrementOutsInHalfOnResult,
  nextRound,
  startRound,
  stopRound,
  updateRoundPredictionResult,
} from "./predictionStorage";

/** 타자 변경 후 예측 중지까지 */
export const LIVE_AUTO_PRED_STOP_MS = 15_000;
/** 공수교대·투수교체 광고 최소 간격 */
export const LIVE_AUTO_AD_COOLDOWN_MS = 90_000;

type AutoState = {
  lastBatterName: string | null;
  lastOuts: number | null;
  lastHalf: InningHalf | null;
  lastInning: number | null;
  lastPitcherName: string | null;
  stopTimer: NodeJS.Timeout | null;
  lastAdAt: number;
  busy: boolean;
  seeded: boolean;
  lastSuggestedResultKey: string | null;
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
      stopTimer: null,
      lastAdAt: 0,
      busy: false,
      seeded: false,
      lastSuggestedResultKey: null,
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

function scheduleAdIfAllowed(matchId: string, reason: "switch_half" | "pitcher_change"): void {
  const state = getState(matchId);
  const now = Date.now();
  if (now - state.lastAdAt < LIVE_AUTO_AD_COOLDOWN_MS) {
    console.log(`[LiveAuto] ad skipped (${reason}) cooldown ${matchId}`);
    return;
  }
  state.lastAdAt = now;
  broadcastManager.clearAdTimer(matchId);
  const rewardKey = `${matchId}:auto-${reason}:${now}`;
  broadcastManager.sendToMatch(matchId, "rewarded_ad_offer", {
    matchId,
    rewardKey,
    points: 500,
    reason,
    source: "live_auto",
  });
  broadcastManager.scheduleAdStart(matchId, 5_000);
}

function scheduleAutoStop(matchId: string): void {
  clearStopTimer(matchId);
  const state = getState(matchId);
  state.stopTimer = setTimeout(() => {
    state.stopTimer = null;
    void (async () => {
      try {
        const match = await MatchModel.findOne({ id: matchId })
          .select("predictionEnabled matchStatus")
          .lean();
        if (!match?.predictionEnabled || match.matchStatus !== "ongoing") return;
        const updated = await stopRound(matchId);
        broadcastManager.sendToMatch(matchId, "prediction_stopped", {
          matchId,
          currentRound: updated.currentRound,
          message: "실황 자동: 예측이 중지되었습니다.",
          source: "live_auto",
        });
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
): Promise<boolean> {
  try {
    if (!(await roundNeedsResult(matchId, currentRound))) return false;
    const userWonAmounts = await updateRoundPredictionResult(matchId, currentRound, suggested);
    await incrementOutsInHalfOnResult(matchId, suggested);
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
}

async function startPredictionForBatter(matchId: string, batterName: string): Promise<void> {
  broadcastManager.clearAdTimer(matchId);
  if (broadcastManager.isAdPlaying(matchId)) {
    broadcastManager.setAdPlaying(matchId, false);
    broadcastManager.sendToMatch(matchId, "ad_stopped", {
      matchId,
      message: "예측 시작으로 광고가 중지되었습니다.",
      source: "live_auto",
    });
  }
  const started = await startRound(matchId);
  broadcastManager.sendToMatch(matchId, "prediction_started", {
    matchId,
    currentRound: started.currentRound,
    message: `실황 자동 예측 시작 — ${batterName}`,
    source: "live_auto",
  });
  scheduleAutoStop(matchId);
  console.log(`[LiveAuto] prediction start ${matchId} batter=${batterName}`);
}

/**
 * 실황 폴링 직후 — DB 초/말·아웃·타순 동기화 + 예측/교대 자동화.
 * 초/말은 실황 값을 그대로 쓰므로 advanceInningHalf 로 한 번 더 넘기지 않는다.
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

    const situation = scoreboard.situation;
    const batterName = situation?.batterName?.trim() || "";
    const pitcherName = situation?.pitcherName?.trim() || "";
    const outs = situation?.outs ?? 0;
    const half = scoreboard.inningHalf ? parseInningHalf(scoreboard.inningHalf) : null;
    const inning = scoreboard.inning ?? null;
    const suggested = situation?.suggestedResult ?? null;

    // 첫 틱은 기준선만 잡고 액션하지 않음 (재시작 시 폭주 방지)
    if (!state.seeded) {
      state.seeded = true;
      state.lastBatterName = batterName || null;
      state.lastOuts = outs;
      state.lastHalf = half;
      state.lastInning = inning;
      state.lastPitcherName = pitcherName || null;
      return;
    }

    const prevBatter = state.lastBatterName;
    const prevOuts = state.lastOuts;
    const prevHalf = state.lastHalf;
    const prevInning = state.lastInning;
    const prevPitcher = state.lastPitcherName;

    const batterChanged =
      Boolean(batterName) &&
      Boolean(prevBatter) &&
      normalizeBatterName(batterName) !== normalizeBatterName(prevBatter!);
    const outsHitThree = prevOuts != null && prevOuts < 3 && outs >= 3;
    const halfChanged =
      half != null &&
      prevHalf != null &&
      (half !== prevHalf || (inning != null && prevInning != null && inning !== prevInning));
    const pitcherChanged =
      Boolean(pitcherName) &&
      Boolean(prevPitcher) &&
      normalizeBatterName(pitcherName) !== normalizeBatterName(prevPitcher!);

    // 결과 제안 — 중지 후·미전송. 자동 확정은 아웃 증가(아웃) 또는 타자 교체 직후 홈런만.
    if (suggested) {
      const round = match.currentRound ?? 1;
      const key = `${round}:${suggested}:${batterName || prevBatter || ""}`;
      if ((await roundNeedsResult(matchId, round)) && state.lastSuggestedResultKey !== key) {
        state.lastSuggestedResultKey = key;
        broadcastManager.sendToMatch(matchId, "auto_result_suggested", {
          matchId,
          currentRound: round,
          suggestedResult: suggested,
          batterName: batterName || prevBatter,
          message: `실황 추정 결과: ${suggested}`,
        });
        const canAutoOut = suggested === "아웃" && prevOuts != null && outs > prevOuts;
        const canAutoHr = suggested === "홈런" && (batterChanged || (prevOuts != null && outs === prevOuts));
        if (canAutoOut || canAutoHr) {
          await tryApplySuggestedResult(matchId, round, suggested);
        }
      }
    }

    // 공수교대(실황 초/말 전환 또는 3아웃) — phase는 이미 sync됨, 라운드·광고만
    if (halfChanged || outsHitThree) {
      try {
        await stopPredictionIfOpen(matchId, "실황 자동: 공수교대 전 예측 중지");
        const fresh = await MatchModel.findOne({ id: matchId }).lean();
        const round = fresh?.currentRound ?? 1;
        if (fresh && (await roundNeedsResult(matchId, round))) {
          broadcastManager.sendToMatch(matchId, "auto_action_blocked", {
            matchId,
            action: "switch_half",
            message: "공수교대 전 예측 결과를 입력해 주세요.",
            suggestedResult: suggested,
          });
        } else if (fresh) {
          try {
            await nextRound(matchId);
          } catch {
            // 예측 라운드가 없으면 스킵
          }
          await emitPhaseSnapshot(matchId, "switch_half", "실황 자동 공수교대");
          scheduleAdIfAllowed(matchId, "switch_half");
          console.log(`[LiveAuto] switch half ${matchId}`);
        }
      } catch (error) {
        console.warn(`[LiveAuto] switch half failed ${matchId}:`, error);
      }
    }

    // 투수 교체 — 환불·라운드 증가 + 광고
    if (pitcherChanged && outs < 3) {
      try {
        const { skippedResult } = await advancePitcherChange(matchId);
        await syncPhaseFromLive(matchId, scoreboard);
        await emitPhaseSnapshot(
          matchId,
          "pitcher_change",
          `실황 자동 투수교체 — ${pitcherName}`,
          skippedResult,
        );
        scheduleAdIfAllowed(matchId, "pitcher_change");
        console.log(`[LiveAuto] pitcher change ${matchId} → ${pitcherName}`);
      } catch (error) {
        console.warn(`[LiveAuto] pitcher change failed ${matchId}:`, error);
      }
    }

    // 타자 변경 → (필요 시 라운드 진행) + 예측 시작 + 15초 중지
    if (batterChanged && outs < 3) {
      try {
        clearStopTimer(matchId);
        await stopPredictionIfOpen(matchId, "실황 자동: 타자 변경으로 예측 중지");

        let current = await MatchModel.findOne({ id: matchId }).lean();
        if (!current) return;
        const round = current.currentRound ?? 1;

        if (await roundNeedsResult(matchId, round)) {
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
          if (stats?.isResultSent) {
            try {
              await advanceToNextBatter(matchId);
            } catch {
              try {
                await nextRound(matchId);
              } catch {
                /* ignore */
              }
            }
            await syncPhaseFromLive(matchId, scoreboard);
            await emitPhaseSnapshot(matchId, "next_batter", `실황 자동 다음 타자 — ${batterName}`);
          }

          // 대타 힌트
          current = await MatchModel.findOne({ id: matchId }).lean();
          const lineup = (current?.matchLineup as MatchLineupSnapshot | null) ?? null;
          const halfNow = parseInningHalf(current?.inningHalf) ?? half;
          if (lineup && halfNow && batterName) {
            const side = halfNow === "top" ? lineup.away : lineup.home;
            const idx = current?.batterIndexInHalf ?? 1;
            const expected = [...(side ?? [])]
              .sort((a, b) => a.battingOrder - b.battingOrder)
              .find((p) => wrapBatterOrder(p.battingOrder) === wrapBatterOrder(idx));
            if (
              expected?.name &&
              normalizeBatterName(expected.name) !== normalizeBatterName(batterName)
            ) {
              broadcastManager.sendToMatch(matchId, "auto_pinch_suggested", {
                matchId,
                expectedName: expected.name,
                liveName: batterName,
                message: `대타 후보: 예정 ${expected.name} → 실황 ${batterName}`,
              });
            }
          }

          await startPredictionForBatter(matchId, batterName);
        }
      } catch (error) {
        console.warn(`[LiveAuto] batter change flow failed ${matchId}:`, error);
      }
    }

    state.lastBatterName = batterName || state.lastBatterName;
    state.lastOuts = outs;
    if (half) state.lastHalf = half;
    if (inning != null) state.lastInning = inning;
    if (pitcherName) state.lastPitcherName = pitcherName;
  } finally {
    state.busy = false;
  }
}

export function clearLiveAutoOperator(matchId: string): void {
  clearStopTimer(matchId);
  stateByMatch.delete(matchId);
}
