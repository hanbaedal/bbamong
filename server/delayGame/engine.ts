/**
 * 딜레이 봇 — Match 문서는 읽기만 한다. predictionEnabled / WS / RoundStatistics 를 건드리지 않는다.
 */
import {
  DELAY_AD_BREAK_MS,
  DELAY_BATTER_STABLE_MS,
  DELAY_PREDICTION_OPEN_MS,
  DELAY_RESULT_STABLE_MS,
  DELAY_SCHEDULER_MATCH_STATUSES,
  delayBatterKey,
  delayHalfChanged,
  delayPitcherChanged,
  delaySameBatter,
  isDelayMatchEnded,
  isDelayMatchOngoing,
  isDelaySuggestedResult,
  type DelayAdReason,
  type DelayGamePhase,
  type DelaySuggestedResult,
} from "@shared/delayGame";
import { calculateFixedOddsPayout } from "@shared/predictionOdds";
import type { LiveScoreboard } from "@shared/apiSportsTypes";
import { mongoose, MatchModel, UserModel, PointTransactionModel, getNextSequence } from "../UserStorage/db";
import { getKstDateString } from "../utils/dateUtils";
import { DelayGameStateModel, DelayPredictionModel } from "./models";

export type DelayStateDoc = {
  sourceMatchId: string;
  roundNumber: number;
  phase: DelayGamePhase;
  batterKey: string | null;
  batterName: string | null;
  pendingBatterName: string | null;
  pendingBatterSince: number | null;
  lastHalf: string | null;
  lastInning: number | null;
  lastOuts: number | null;
  lastPitcherName: string | null;
  pendingResult: string | null;
  pendingResultSince: number | null;
  settledResult: string | null;
  openAtMs: number | null;
  adUntilMs: number | null;
  adReason: DelayAdReason | null;
  adRewardKey: string | null;
  seeded: boolean;
  /** 이번 타석 이후 다른 타자를 한 번이라도 봄 — 같은 이름 재타석 오픈 */
  seenOtherBatter: boolean;
};

export function snapshotLive(scoreboard: LiveScoreboard | null | undefined) {
  const sit = scoreboard?.situation;
  return {
    inning: typeof scoreboard?.inning === "number" ? scoreboard.inning : null,
    half: scoreboard?.inningHalf ? String(scoreboard.inningHalf) : null,
    outs: typeof sit?.outs === "number" ? sit.outs : null,
    batterName: sit?.batterName?.trim() || "",
    pitcherName: sit?.pitcherName?.trim() || "",
    suggested: isDelaySuggestedResult(sit?.suggestedResult) ? sit.suggestedResult : null,
    statusShort: scoreboard?.statusShort || "",
  };
}

function holdUntilOngoing(
  state: DelayStateDoc,
  live: ReturnType<typeof snapshotLive>,
): { patch: Partial<DelayStateDoc>; settleRound: boolean; settleResult: DelaySuggestedResult | null } {
  if (state.phase === "open" || state.phase === "closed") {
    return {
      patch: {
        phase: "idle",
        openAtMs: null,
        pendingBatterName: null,
        pendingBatterSince: null,
        pendingResult: null,
        pendingResultSince: null,
      },
      settleRound: true,
      settleResult: null,
    };
  }
  const patch: Partial<DelayStateDoc> = {};
  if (!state.seeded) {
    patch.seeded = true;
    patch.lastHalf = live.half;
    patch.lastInning = live.inning;
    patch.lastOuts = live.outs;
    patch.lastPitcherName = live.pitcherName || null;
    patch.pendingBatterName = null;
    patch.pendingBatterSince = null;
    return { patch, settleRound: false, settleResult: null };
  }
  if (state.pendingBatterName || state.pendingBatterSince != null) {
    return {
      patch: { pendingBatterName: null, pendingBatterSince: null },
      settleRound: false,
      settleResult: null,
    };
  }
  return { patch: {}, settleRound: false, settleResult: null };
}

export function nextDelayPhase(input: {
  state: DelayStateDoc;
  now: number;
  live: ReturnType<typeof snapshotLive>;
  matchEnded: boolean;
  matchOngoing: boolean;
}): { patch: Partial<DelayStateDoc>; settleRound: boolean; settleResult: DelaySuggestedResult | null } {
  const { state, now, live, matchEnded, matchOngoing } = input;
  if (matchEnded) {
    return {
      patch: { phase: "ended", adUntilMs: null, adReason: null },
      settleRound: state.phase === "open" || state.phase === "closed",
      settleResult: isDelaySuggestedResult(state.pendingResult) ? state.pendingResult : null,
    };
  }

  if (state.phase === "ad") {
    if (state.adUntilMs && now < state.adUntilMs) {
      return { patch: {}, settleRound: false, settleResult: null };
    }
    return {
      patch: {
        phase: "idle",
        adUntilMs: null,
        adReason: null,
        lastHalf: live.half,
        lastInning: live.inning,
        lastPitcherName: live.pitcherName || state.lastPitcherName,
        pendingBatterName: live.batterName || null,
        pendingBatterSince: live.batterName ? now : null,
        seenOtherBatter: true,
      },
      settleRound: false,
      settleResult: null,
    };
  }

  if (!matchOngoing) {
    return holdUntilOngoing(state, live);
  }

  if (!state.seeded) {
    return {
      patch: {
        seeded: true,
        lastHalf: live.half,
        lastInning: live.inning,
        lastOuts: live.outs,
        lastPitcherName: live.pitcherName || null,
        pendingBatterName: live.batterName || null,
        pendingBatterSince: live.batterName ? now : null,
      },
      settleRound: false,
      settleResult: null,
    };
  }

  if (state.phase === "idle") {
    const name = live.batterName;
    if (!name) return { patch: {}, settleRound: false, settleResult: null };
    const same = delaySameBatter(name, state.pendingBatterName);
    const since = same ? state.pendingBatterSince ?? now : now;
    const patch: Partial<DelayStateDoc> = {
      pendingBatterName: name,
      pendingBatterSince: since,
    };
    const key = delayBatterKey({
      inning: live.inning,
      half: live.half,
      outs: live.outs,
      batterName: name,
    });
    let seenOther = Boolean(state.seenOtherBatter);
    if (state.batterName && !delaySameBatter(name, state.batterName)) {
      seenOther = true;
    }
    if (seenOther !== Boolean(state.seenOtherBatter)) {
      patch.seenOtherBatter = seenOther;
    }
    const newAppearance = key !== state.batterKey || seenOther;
    if (same && now - since >= DELAY_BATTER_STABLE_MS && newAppearance) {
      patch.phase = "open";
      patch.roundNumber = state.roundNumber + 1;
      patch.batterKey = key;
      patch.batterName = name;
      patch.openAtMs = now;
      patch.settledResult = null;
      patch.pendingResult = null;
      patch.pendingResultSince = null;
      patch.seenOtherBatter = false;
      patch.lastOuts = live.outs;
    }
    return { patch, settleRound: false, settleResult: null };
  }

  if (state.phase === "open") {
    const suggestedPatch: Partial<DelayStateDoc> = {};
    if (live.suggested) {
      if (live.suggested !== state.pendingResult) {
        suggestedPatch.pendingResult = live.suggested;
        suggestedPatch.pendingResultSince = now;
      } else if (state.pendingResultSince == null) {
        suggestedPatch.pendingResult = live.suggested;
        suggestedPatch.pendingResultSince = now;
      }
    }
    if (state.openAtMs && now - state.openAtMs >= DELAY_PREDICTION_OPEN_MS) {
      return {
        patch: { ...suggestedPatch, phase: "closed" },
        settleRound: false,
        settleResult: null,
      };
    }
    return { patch: suggestedPatch, settleRound: false, settleResult: null };
  }

  if (state.phase === "closed") {
    const batterLeft =
      Boolean(state.batterName) &&
      Boolean(live.batterName) &&
      !delaySameBatter(state.batterName, live.batterName);
    let pending = state.pendingResult;
    let since = state.pendingResultSince;
    if (!batterLeft && live.suggested) {
      if (live.suggested !== pending) {
        pending = live.suggested;
        since = now;
      } else if (since == null) {
        since = now;
      }
    }
    const stable =
      isDelaySuggestedResult(pending) &&
      since != null &&
      now - since >= DELAY_RESULT_STABLE_MS;
    if (!stable && !(batterLeft && !isDelaySuggestedResult(pending))) {
      return {
        patch: { pendingResult: pending, pendingResultSince: since },
        settleRound: false,
        settleResult: null,
      };
    }
    const result = isDelaySuggestedResult(pending) ? pending : null;
    const halfChanged = delayHalfChanged({
      prevInning: state.lastInning,
      prevHalf: state.lastHalf,
      nextInning: live.inning,
      nextHalf: live.half,
    });
    const pitcherChanged =
      !halfChanged && delayPitcherChanged(state.lastPitcherName, live.pitcherName);
    const patch: Partial<DelayStateDoc> = {
      settledResult: result,
      pendingResult: pending,
      pendingResultSince: since,
      lastHalf: live.half,
      lastInning: live.inning,
      lastOuts: live.outs,
      lastPitcherName: live.pitcherName || state.lastPitcherName,
      seenOtherBatter: batterLeft,
    };
    if (halfChanged || pitcherChanged) {
      const reason: DelayAdReason = halfChanged ? "switch_half" : "pitcher_change";
      patch.phase = "ad";
      patch.adReason = reason;
      patch.adUntilMs = now + DELAY_AD_BREAK_MS;
      patch.adRewardKey = `${state.sourceMatchId}:${state.roundNumber}:${reason}`;
    } else {
      patch.phase = "idle";
      patch.pendingBatterName = live.batterName || null;
      patch.pendingBatterSince = now;
    }
    return { patch, settleRound: true, settleResult: result };
  }

  return { patch: {}, settleRound: false, settleResult: null };
}

export function emptyDelayState(overrides: Partial<DelayStateDoc> = {}): DelayStateDoc {
  return {
    sourceMatchId: "test-match",
    roundNumber: 0,
    phase: "idle",
    batterKey: null,
    batterName: null,
    pendingBatterName: null,
    pendingBatterSince: null,
    lastHalf: null,
    lastInning: null,
    lastOuts: null,
    lastPitcherName: null,
    pendingResult: null,
    pendingResultSince: null,
    settledResult: null,
    openAtMs: null,
    adUntilMs: null,
    adReason: null,
    adRewardKey: null,
    seeded: false,
    seenOtherBatter: false,
    ...overrides,
  };
}

/** 실시간 getTodayMatchesForClient 를 호출하지 않는다 (사이드이펙트 없음). */
export function todayDelayMatchFilter() {
  const kstToday = getKstDateString();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    $or: [
      { matchDate: kstToday },
      { matchDate: null, startTime: { $gte: today, $lt: tomorrow } },
    ],
  };
}

async function ensureState(sourceMatchId: string) {
  let doc = await DelayGameStateModel.findOne({ sourceMatchId }).lean();
  if (doc) return doc as unknown as DelayStateDoc & { id: number };
  const id = await getNextSequence("delayGameState");
  await DelayGameStateModel.create({
    id,
    sourceMatchId,
    roundNumber: 0,
    phase: "idle",
    seeded: false,
    updatedAt: new Date(),
  });
  doc = await DelayGameStateModel.findOne({ sourceMatchId }).lean();
  return doc as unknown as DelayStateDoc & { id: number };
}

async function settleRound(
  sourceMatchId: string,
  roundNumber: number,
  result: DelaySuggestedResult | null,
): Promise<void> {
  const pending = await DelayPredictionModel.find({
    sourceMatchId,
    roundNumber,
    status: "pending",
  }).lean();
  if (pending.length === 0) return;

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    for (const bet of pending) {
      if (!result) {
        const user = await UserModel.findOneAndUpdate(
          { id: bet.userId },
          { $inc: { points: bet.amount } },
          { new: true, session },
        ).lean();
        const txId = await getNextSequence("pointTransaction");
        await PointTransactionModel.create(
          [
            {
              id: txId,
              userId: bet.userId,
              transactionType: "earned",
              amount: bet.amount,
              balance: user?.points ?? 0,
              description: `딜레이 예측 환불 (결과 없음) +${bet.amount}P`,
            },
          ],
          { session },
        );
        await DelayPredictionModel.updateOne(
          { id: bet.id },
          { $set: { status: "refunded", result: null, wonAmount: 0 } },
          { session },
        );
        continue;
      }
      const won = bet.prediction === result;
      const wonAmount = won ? calculateFixedOddsPayout(bet.amount, result) : 0;
      if (wonAmount > 0) {
        const user = await UserModel.findOneAndUpdate(
          { id: bet.userId },
          { $inc: { points: wonAmount } },
          { new: true, session },
        ).lean();
        const txId = await getNextSequence("pointTransaction");
        await PointTransactionModel.create(
          [
            {
              id: txId,
              userId: bet.userId,
              transactionType: "earned",
              amount: wonAmount,
              balance: user?.points ?? 0,
              description: `딜레이 예측 적중 ${result} +${wonAmount}P`,
            },
          ],
          { session },
        );
      }
      await DelayPredictionModel.updateOne(
        { id: bet.id },
        {
          $set: {
            status: won ? "won" : "lost",
            result,
            wonAmount,
          },
        },
        { session },
      );
    }
    await session.commitTransaction();
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch {
      /* ignore */
    }
    throw error;
  } finally {
    session.endSession();
  }
}

export async function tickDelayMatch(sourceMatchId: string, now = Date.now()): Promise<void> {
  const match = await MatchModel.findOne({ id: sourceMatchId })
    .select("id matchStatus liveScoreboard")
    .lean();
  if (!match) return;
  const ended = isDelayMatchEnded(match.matchStatus);
  const matchOngoing = isDelayMatchOngoing(match.matchStatus);
  let state = (await DelayGameStateModel.findOne({ sourceMatchId }).lean()) as
    | (DelayStateDoc & { id: number })
    | null;
  if (!state) {
    if (ended) return;
    state = await ensureState(sourceMatchId);
  }
  const live = snapshotLive(
    (match as { liveScoreboard?: LiveScoreboard | null }).liveScoreboard,
  );
  const next = nextDelayPhase({
    state,
    now,
    live,
    matchEnded: ended,
    matchOngoing,
  });
  if (next.settleRound) {
    await settleRound(sourceMatchId, state.roundNumber, next.settleResult);
  }
  if (Object.keys(next.patch).length === 0 && !next.settleRound) return;
  await DelayGameStateModel.updateOne(
    { sourceMatchId },
    { $set: { ...next.patch, updatedAt: new Date() } },
  );
}

export async function tickAllDelayGames(now = Date.now()): Promise<void> {
  const todayDocs = await MatchModel.find({
    ...todayDelayMatchFilter(),
    matchStatus: { $in: [...DELAY_SCHEDULER_MATCH_STATUSES] },
  })
    .select("id")
    .lean();
  const activeDelay = await DelayGameStateModel.find({
    phase: { $ne: "ended" },
  })
    .select("sourceMatchId")
    .lean();
  const ids = new Set<string>();
  for (const match of todayDocs) ids.add(String(match.id));
  for (const doc of activeDelay) ids.add(String(doc.sourceMatchId));
  for (const matchId of ids) {
    try {
      await tickDelayMatch(matchId, now);
    } catch (error) {
      console.warn(`[DelayGame] tick failed ${matchId}:`, error);
    }
  }
}

let delayTimer: NodeJS.Timeout | null = null;

export function startDelayGameScheduler(): void {
  if (delayTimer) return;
  delayTimer = setInterval(() => {
    void tickAllDelayGames().catch((error) => {
      console.warn("[DelayGame] scheduler error:", error);
    });
  }, 1_000);
  console.log("[DelayGame] scheduler started (1s) — live match writes disabled");
}
