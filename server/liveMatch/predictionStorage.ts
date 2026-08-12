import {
  mongoose,
  UserModel,
  PredictionModel,
  PointTransactionModel,
  MatchModel,
  RoundStatisticsModel,
  getNextSequence,
} from "../UserStorage/db";
import type {
  InsertPrediction,
  Prediction,
  Match,
  RoundStatistics,
} from "@shared/schema";
import { computeInningHalfSwitch } from "./gamePhase";
import { calculateFixedOddsPayout } from "@shared/predictionOdds";
import type { ClientSession } from "mongoose";
import {
  type MemberPlatform,
  buildUserPlatformMatchForAgg,
} from "../utils/memberPlatform";
import { overlayOperatorInningOnScoreboard } from "../apiSports/liveScoreboardPolicy";
import type { LiveScoreboard } from "@shared/apiSportsTypes";
import { parseInningHalf } from "@shared/gamePhaseTypes";

/**
 * 운영자 컨트롤용 — ongoing만 허용.
 * 단, 시작 시각이 지났는데 API 지연으로 scheduled에 남으면 ongoing으로 승격.
 * (오전 경기전 false start 방지: startTime 이전에는 거부)
 */
export async function ensureMatchLiveForOperatorControls(matchId: string): Promise<void> {
  const match = await MatchModel.findOne({ id: matchId })
    .select("id matchStatus startTime name")
    .lean();
  if (!match) throw new Error("경기를 찾을 수 없습니다.");

  if (match.matchStatus === "ongoing") return;

  if (match.matchStatus === "completed" || match.matchStatus === "cancelled") {
    throw new Error("경기가 종료되어 사용할 수 없습니다.");
  }

  if (match.matchStatus === "scheduled") {
    const startMs = match.startTime ? new Date(match.startTime as Date).getTime() : Number.NaN;
    if (!Number.isFinite(startMs) || Date.now() < startMs) {
      throw new Error("경기전에 사용할 수 없습니다. 경기가 시작되면 이용해 주세요.");
    }

    await MatchModel.updateOne({ id: matchId }, { $set: { matchStatus: "ongoing" } });
    console.log(
      `[MatchStatus] operator control promoted scheduled→ongoing (${match.name ?? matchId}) — startTime passed`,
    );
    try {
      const { syncOperatorAccountStatusForMatchId } = await import("../managerOperatorService");
      await syncOperatorAccountStatusForMatchId(matchId);
    } catch (err) {
      console.warn("[MatchStatus] operator account sync after promote failed:", err);
    }
    return;
  }

  throw new Error("경기전에 사용할 수 없습니다. 경기가 시작되면 이용해 주세요.");
}

export async function getUserBalance(userId: string): Promise<number> {
  const user = await UserModel.findOne({ id: userId }).select("points").lean();
  return user?.points ?? 0;
}

async function createPointTransaction(
  session: ClientSession,
  data: {
    userId: string;
    transactionType: string;
    amount: number;
    balance: number;
    description: string;
  },
) {
  const id = await getNextSequence("pointTransaction");
  await PointTransactionModel.create([{ id, ...data }], { session });
}

function roundStatsQuery(matchId: string, roundNumber: number) {
  return { matchId, roundNumber };
}

export async function createPredictionWithPointDeduction(
  predictionData: InsertPrediction,
): Promise<Prediction> {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const amount = predictionData.amount ?? 100;
    const roundNumber = predictionData.roundNumber ?? 1;

    const existingPrediction = await PredictionModel.findOne({
      userId: predictionData.userId,
      matchId: predictionData.matchId,
      roundNumber,
    })
      .session(session)
      .lean();

    if (existingPrediction) {
      if (existingPrediction.status !== "pending") {
        throw new Error("이미 결과가 확정된 예측은 변경할 수 없습니다.");
      }
      const updated = await PredictionModel.findOneAndUpdate(
        { id: existingPrediction.id },
        { prediction: predictionData.prediction },
        { new: true, session },
      ).lean();
      await session.commitTransaction();
      return updated as Prediction;
    }

    const predId = await getNextSequence("prediction");
    const [insertedPrediction] = await PredictionModel.create(
      [
        {
          id: predId,
          userId: predictionData.userId,
          matchId: predictionData.matchId,
          roundNumber,
          prediction: predictionData.prediction,
          amount,
          status: "pending",
        },
      ],
      { session },
    );

    const updatedUser = await UserModel.findOneAndUpdate(
      { id: predictionData.userId, points: { $gte: amount } },
      { $inc: { points: -amount } },
      { new: true, session },
    ).lean();

    if (!updatedUser) {
      const user = await UserModel.findOne({ id: predictionData.userId }).session(session).lean();
      if (!user) throw new Error("사용자를 찾을 수 없습니다.");
      throw new Error("참여기회가 부족합니다.");
    }

    await createPointTransaction(session, {
      userId: predictionData.userId,
      transactionType: "spent",
      amount: -amount,
      balance: updatedUser.points,
      description: `경기 예측 참여 (${amount}포인트)`,
    });

    await session.commitTransaction();
    return insertedPrediction.toObject() as Prediction;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function cancelPredictionAndRefundPoints(
  predictionId: number,
  userId: string,
): Promise<void> {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const deleted = await PredictionModel.findOneAndDelete({
      id: predictionId,
      userId,
      status: "pending",
    })
      .session(session)
      .lean();

    if (!deleted) {
      throw new Error("취소할 수 있는 예측이 없습니다.");
    }

    const amount = deleted.amount ?? 100;
    const { matchId, roundNumber } = deleted;

    const match = await MatchModel.findOne({ id: matchId }).session(session).lean();
    if (!match || match.currentRound !== roundNumber) {
      throw new Error("현재 라운드의 예측만 취소할 수 있습니다.");
    }

    const updatedUser = await UserModel.findOneAndUpdate(
      { id: userId },
      { $inc: { points: amount } },
      { new: true, session },
    ).lean();

    if (!updatedUser) throw new Error("사용자를 찾을 수 없습니다.");

    await createPointTransaction(session, {
      userId,
      transactionType: "refund",
      amount,
      balance: updatedUser.points,
      description: `예측 취소 환불 (${amount}포인트)`,
    });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function updatePredictionChoice(
  predictionId: number,
  newPrediction: string,
): Promise<Prediction> {
  const updated = await PredictionModel.findOneAndUpdate(
    { id: predictionId, status: "pending" },
    { prediction: newPrediction },
    { new: true },
  ).lean();

  if (!updated) {
    throw new Error("예측을 변경할 수 없습니다. 이미 결과가 확정되었습니다.");
  }
  return updated as Prediction;
}

export async function getPredictionById(id: number): Promise<Prediction | undefined> {
  const doc = await PredictionModel.findOne({ id }).lean();
  return doc ? (doc as Prediction) : undefined;
}

export async function getPredictionsByMatch(matchId: string): Promise<Prediction[]> {
  const docs = await PredictionModel.find({ matchId }).lean();
  return docs as Prediction[];
}

export async function getPredictionsByUser(userId: string): Promise<Prediction[]> {
  const docs = await PredictionModel.find({ userId }).lean();
  return docs as Prediction[];
}

export async function getUserPendingPrediction(
  userId: string,
): Promise<(Prediction & { match: Match }) | undefined> {
  const prediction = await PredictionModel.findOne({ userId, status: "pending" })
    .sort({ createdAt: -1 })
    .lean();
  if (!prediction) return undefined;

  const match = await MatchModel.findOne({ id: prediction.matchId }).lean();
  if (!match) return undefined;

  return { ...(prediction as Prediction), match: match as Match };
}

export async function getUserPredictionForMatch(
  userId: string,
  matchId: string,
): Promise<Prediction | undefined> {
  const doc = await PredictionModel.findOne({ userId, matchId }).lean();
  return doc ? (doc as Prediction) : undefined;
}

export async function updatePredictionResult(matchId: string, result: string): Promise<void> {
  const predictions = await PredictionModel.find({ matchId }).lean();
  for (const p of predictions) {
    await PredictionModel.updateOne(
      { id: p.id },
      { result, status: p.prediction === result ? "success" : "fail" },
    );
  }
}

export async function addUserPoints(userId: string, amount: number): Promise<void> {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const user = await UserModel.findOneAndUpdate(
      { id: userId },
      { $inc: { points: amount } },
      { new: true, session },
    ).lean();

    if (user) {
      await createPointTransaction(session, {
        userId,
        transactionType: "earned",
        amount,
        balance: user.points,
        description: `경기 예측 성공 보상 (+${amount}포인트)`,
      });
    }
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export const PREDICTION_TOGGLE_GRACE_MS = 1000;

async function refundPendingPredictionsForRound(
  session: ClientSession,
  matchId: string,
  roundNumber: number,
): Promise<number> {
  const pending = await PredictionModel.find({
    matchId,
    roundNumber,
    status: "pending",
  })
    .session(session)
    .lean();

  for (const pred of pending) {
    const refundAmount = pred.amount ?? 100;
    const updatedUser = await UserModel.findOneAndUpdate(
      { id: pred.userId },
      { $inc: { points: refundAmount } },
      { new: true, session },
    ).lean();

    if (updatedUser) {
      await createPointTransaction(session, {
        userId: pred.userId,
        transactionType: "refund",
        amount: refundAmount,
        balance: updatedUser.points,
        description: `라운드 ${roundNumber} 취소·투수교체로 인한 환불 (${refundAmount}포인트)`,
      });
    }
  }

  if (pending.length > 0) {
    await PredictionModel.deleteMany(
      { matchId, roundNumber, status: "pending" },
      { session },
    );
  }

  return pending.length;
}

export async function startRound(matchId: string): Promise<Match> {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const match = await MatchModel.findOne({ id: matchId }).session(session).lean();
    if (!match) throw new Error("경기를 찾을 수 없습니다.");

    let currentRound =
      typeof match.currentRound === "number" && Number.isFinite(match.currentRound)
        ? match.currentRound
        : 1;
    let existing = await RoundStatisticsModel.findOne({
      matchId,
      roundNumber: currentRound,
    })
      .session(session)
      .lean();

    /**
     * 결과가 이미 전송된 라운드에 currentRound가 고착되면(자동 다음타자 실패·3아웃 대기 등)
     * 예측 시작이 500으로 막힘 → 다음 라운드로 넘겨 새 타석 예측을 연다.
     */
    if (existing?.isResultSent) {
      currentRound += 1;
      await MatchModel.updateOne(
        { id: matchId },
        { $set: { currentRound, predictionEnabled: false } },
        { session },
      );
      existing = await RoundStatisticsModel.findOne({
        matchId,
        roundNumber: currentRound,
      })
        .session(session)
        .lean();
      console.log(
        `[Prediction] startRound healed result-sent sticky round → ${currentRound} (${matchId})`,
      );
    }

    if (existing && existing.isPredictionStarted && !existing.isPredictionStopped) {
      if (match.predictionEnabled && currentRound === match.currentRound) {
        await session.commitTransaction();
        return match as Match;
      }
      const syncedMatch = await MatchModel.findOneAndUpdate(
        { id: matchId },
        { predictionEnabled: true, sideBetsLocked: true, currentRound },
        { new: true, session },
      ).lean();
      await session.commitTransaction();
      if (!syncedMatch) throw new Error("경기를 찾을 수 없습니다.");
      return syncedMatch as Match;
    }

    const updatedMatch = await MatchModel.findOneAndUpdate(
      { id: matchId },
      { predictionEnabled: true, sideBetsLocked: true, currentRound },
      { new: true, session },
    ).lean();

    if (existing && existing.isPredictionStarted && existing.isPredictionStopped) {
      const deletedPredictions = await PredictionModel.find({
        matchId,
        roundNumber: currentRound,
        status: "pending",
      })
        .session(session)
        .lean();

      await PredictionModel.deleteMany(
        { matchId, roundNumber: currentRound, status: "pending" },
        { session },
      );

      for (const pred of deletedPredictions) {
        const refundAmount = pred.amount ?? 100;
        const updatedUser = await UserModel.findOneAndUpdate(
          { id: pred.userId },
          { $inc: { points: refundAmount } },
          { new: true, session },
        ).lean();

        if (updatedUser) {
          await createPointTransaction(session, {
            userId: pred.userId,
            transactionType: "refund",
            amount: refundAmount,
            balance: updatedUser.points,
            description: `예측 재시작으로 인한 자동 환불 (${refundAmount}포인트)`,
          });
        }
      }

      await RoundStatisticsModel.updateOne(
        roundStatsQuery(matchId, currentRound),
        {
          predictionStartTime: new Date(),
          predictionStopTime: null,
          isPredictionStarted: true,
          isPredictionStopped: false,
          isResultSent: false,
          totalParticipants: 0,
          totalPoints: 0,
          totalWinners: 0,
        },
        { session },
      );
    } else if (existing) {
      await RoundStatisticsModel.updateOne(
        roundStatsQuery(matchId, currentRound),
        {
          predictionStartTime: new Date(),
          predictionStopTime: null,
          isPredictionStarted: true,
          isPredictionStopped: false,
          isResultSent: false,
        },
        { session },
      );
    } else {
      const statsId = await getNextSequence("roundStatistics");
      await RoundStatisticsModel.create(
        [
          {
            id: statsId,
            matchId,
            roundNumber: currentRound,
            totalParticipants: 0,
            totalPoints: 0,
            totalWinners: 0,
            predictionStartTime: new Date(),
            isPredictionStarted: true,
            isPredictionStopped: false,
            isResultSent: false,
          },
        ],
        { session },
      );
    }

    await session.commitTransaction();
    if (!updatedMatch) throw new Error("경기를 찾을 수 없습니다.");
    return updatedMatch as Match;
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch {
      /* ignore abort errors */
    }
    throw error;
  } finally {
    session.endSession();
  }
}

export async function stopRound(matchId: string): Promise<Match> {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const match = await MatchModel.findOne({ id: matchId }).session(session).lean();
    if (!match) throw new Error("경기를 찾을 수 없습니다.");

    const currentRound = match.currentRound;
    const statsFilter = roundStatsQuery(matchId, currentRound);
    let existing = await RoundStatisticsModel.findOne(statsFilter)
      .session(session)
      .lean();

    if (existing?.isPredictionStopped) {
      if (!match.predictionEnabled) {
        await session.commitTransaction();
        return match as Match;
      }
      const syncedMatch = await MatchModel.findOneAndUpdate(
        { id: matchId },
        { predictionEnabled: false },
        { new: true, session },
      ).lean();
      await session.commitTransaction();
      if (!syncedMatch) throw new Error("경기를 찾을 수 없습니다.");
      return syncedMatch as Match;
    }

    if (match.predictionEnabled && (!existing || !existing.isPredictionStarted)) {
      const now = new Date();
      if (existing) {
        await RoundStatisticsModel.updateOne(
          statsFilter,
          {
            predictionStartTime: existing.predictionStartTime ?? now,
            isPredictionStarted: true,
            isPredictionStopped: false,
          },
          { session },
        );
      } else {
        const statsId = await getNextSequence("roundStatistics");
        await RoundStatisticsModel.create(
          [
            {
              id: statsId,
              matchId,
              roundNumber: currentRound,
              totalParticipants: 0,
              totalPoints: 0,
              totalWinners: 0,
              predictionStartTime: now,
              isPredictionStarted: true,
              isPredictionStopped: false,
              isResultSent: false,
            },
          ],
          { session },
        );
      }
      existing = await RoundStatisticsModel.findOne(statsFilter).session(session).lean();
    }

    if (!existing || !existing.isPredictionStarted) {
      throw new Error(`라운드 ${currentRound}의 예측이 아직 시작되지 않았습니다.`);
    }

    const updatedMatch = await MatchModel.findOneAndUpdate(
      { id: matchId },
      { predictionEnabled: false },
      { new: true, session },
    ).lean();

    if (!updatedMatch) throw new Error("경기를 찾을 수 없습니다.");

    await RoundStatisticsModel.updateOne(
      statsFilter,
      { predictionStopTime: new Date(), isPredictionStopped: true },
      { session },
    );

    await session.commitTransaction();
    return updatedMatch as Match;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/** 예측 시작 직후(1초 이내) 토글 취소 */
export async function cancelStartRound(matchId: string): Promise<Match> {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const match = await MatchModel.findOne({ id: matchId }).session(session).lean();
    if (!match) throw new Error("경기를 찾을 수 없습니다.");

    const currentRound = match.currentRound;
    const existing = await RoundStatisticsModel.findOne({
      matchId,
      roundNumber: currentRound,
    })
      .session(session)
      .lean();

    if (!existing?.isPredictionStarted || existing.isPredictionStopped) {
      throw new Error("취소할 예측 시작이 없습니다.");
    }

    const startMs = existing.predictionStartTime
      ? new Date(existing.predictionStartTime).getTime()
      : 0;
    if (Date.now() - startMs > PREDICTION_TOGGLE_GRACE_MS) {
      throw new Error("예측 시작 취소 가능 시간(1초)이 지났습니다.");
    }

    await refundPendingPredictionsForRound(session, matchId, currentRound);
    await RoundStatisticsModel.deleteOne(roundStatsQuery(matchId, currentRound), { session });

    const updatedMatch = await MatchModel.findOneAndUpdate(
      { id: matchId },
      { predictionEnabled: false },
      { new: true, session },
    ).lean();

    await session.commitTransaction();
    if (!updatedMatch) throw new Error("경기를 찾을 수 없습니다.");
    return updatedMatch as Match;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/** 예측 중지 직후(1초 이내) 토글 취소 — 다시 베팅 열림 */
export async function cancelStopRound(matchId: string): Promise<Match> {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const match = await MatchModel.findOne({ id: matchId }).session(session).lean();
    if (!match) throw new Error("경기를 찾을 수 없습니다.");

    const currentRound = match.currentRound;
    const existing = await RoundStatisticsModel.findOne({
      matchId,
      roundNumber: currentRound,
    })
      .session(session)
      .lean();

    if (!existing?.isPredictionStarted || !existing.isPredictionStopped) {
      throw new Error("취소할 예측 중지가 없습니다.");
    }
    if (existing.isResultSent) {
      throw new Error("결과가 전송된 라운드는 중지 취소할 수 없습니다.");
    }

    const stopMs = existing.predictionStopTime
      ? new Date(existing.predictionStopTime).getTime()
      : 0;
    if (Date.now() - stopMs > PREDICTION_TOGGLE_GRACE_MS) {
      throw new Error("예측 중지 취소 가능 시간(1초)이 지났습니다.");
    }

    const updatedMatch = await MatchModel.findOneAndUpdate(
      { id: matchId },
      { predictionEnabled: true },
      { new: true, session },
    ).lean();

    await RoundStatisticsModel.updateOne(
      roundStatsQuery(matchId, currentRound),
      { isPredictionStopped: false, predictionStopTime: null },
      { session },
    );

    await session.commitTransaction();
    if (!updatedMatch) throw new Error("경기를 찾을 수 없습니다.");
    return updatedMatch as Match;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function endMatch(matchId: string): Promise<Match> {
  const match = await MatchModel.findOneAndUpdate(
    { id: matchId },
    { matchStatus: "completed", predictionEnabled: false, endTime: new Date() },
    { new: true },
  ).lean();

  if (!match) throw new Error("경기를 찾을 수 없습니다.");
  return match as Match;
}

export async function nextRound(
  matchId: string,
): Promise<{ match: Match; predictionAutoStopped: boolean }> {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const match = await MatchModel.findOne({ id: matchId }).session(session).lean();
    if (!match) throw new Error("경기를 찾을 수 없습니다.");

    const currentRound = match.currentRound;
    const existing = await RoundStatisticsModel.findOne({
      matchId,
      roundNumber: currentRound,
    })
      .session(session)
      .lean();

    if (!existing) {
      throw new Error("먼저 예측을 시작하고 결과를 전송해 주세요.");
    }

    if (existing.isPredictionStarted && !existing.isPredictionStopped) {
      throw new Error(
        `라운드 ${currentRound}의 예측이 아직 중지되지 않았습니다. 먼저 예측을 중지해주세요.`,
      );
    }

    if (!existing.isResultSent) {
      throw new Error(
        `라운드 ${currentRound}의 결과가 아직 전송되지 않았습니다. 먼저 결과를 전송해주세요.`,
      );
    }

    const nextRoundNumber = currentRound + 1;
    const updatedMatch = await MatchModel.findOneAndUpdate(
      { id: matchId },
      { currentRound: nextRoundNumber, predictionEnabled: false },
      { new: true, session },
    ).lean();

    await session.commitTransaction();
    return { match: updatedMatch as Match, predictionAutoStopped: false };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

function readGamePhase(doc: Record<string, unknown>) {
  return {
    gameInning: (doc.gameInning as number | undefined) ?? 1,
    inningHalf: (doc.inningHalf === "bottom" ? "bottom" : "top") as "top" | "bottom",
    batterIndexInHalf: (doc.batterIndexInHalf as number | undefined) ?? 1,
  };
}

/** 다음 타자 — 같은 공수, 타순 +1 */
export async function advanceToNextBatter(
  matchId: string,
): Promise<{ match: Match; predictionAutoStopped: boolean }> {
  const before = await MatchModel.findOne({ id: matchId }).lean();
  if (!before) throw new Error("경기를 찾을 수 없습니다.");

  const phase = readGamePhase(before as Record<string, unknown>);
  const nextPhase = {
    ...phase,
    batterIndexInHalf: phase.batterIndexInHalf + 1,
  };

  const { match, predictionAutoStopped } = await nextRound(matchId);
  const updated = await MatchModel.findOneAndUpdate(
    { id: matchId },
    { $set: nextPhase, $unset: { pinchHitter: 1 } },
    { new: true },
  ).lean();

  if (!updated) throw new Error("경기를 찾을 수 없습니다.");
  return { match: updated as Match, predictionAutoStopped };
}

/** 투수 교체 — 공수교대 외 언제든(진행 중 라운드는 환불 후 라운드 증가) */
export async function advancePitcherChange(
  matchId: string,
): Promise<{ match: Match; predictionAutoStopped: boolean; skippedResult: boolean }> {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const before = await MatchModel.findOne({ id: matchId }).session(session).lean();
    if (!before) throw new Error("경기를 찾을 수 없습니다.");

    const currentRound = before.currentRound;
    const existing = await RoundStatisticsModel.findOne({
      matchId,
      roundNumber: currentRound,
    })
      .session(session)
      .lean();

    let predictionAutoStopped = false;
    let skippedResult = false;

    if (existing && !existing.isResultSent) {
      skippedResult = true;
      predictionAutoStopped = Boolean(
        existing.isPredictionStarted && !existing.isPredictionStopped,
      );
      await refundPendingPredictionsForRound(session, matchId, currentRound);
      await RoundStatisticsModel.deleteOne(roundStatsQuery(matchId, currentRound), { session });
    }

    const updated = await MatchModel.findOneAndUpdate(
      { id: matchId },
      { currentRound: currentRound + 1, predictionEnabled: false },
      { new: true, session },
    ).lean();

    await session.commitTransaction();
    if (!updated) throw new Error("경기를 찾을 수 없습니다.");
    return { match: updated as Match, predictionAutoStopped, skippedResult };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/** 공수교대 — 초/말 전환, 타순 1부터 */
export async function advanceInningHalf(
  matchId: string,
): Promise<{ match: Match; predictionAutoStopped: boolean }> {
  const before = await MatchModel.findOne({ id: matchId }).lean();
  if (!before) throw new Error("경기를 찾을 수 없습니다.");

  const phase = readGamePhase(before as Record<string, unknown>);
  const nextPhase = computeInningHalfSwitch(phase);

  const { predictionAutoStopped } = await nextRound(matchId);

  const overlay = overlayOperatorInningOnScoreboard(
    (before as { liveScoreboard?: LiveScoreboard | null }).liveScoreboard,
    nextPhase.gameInning,
    parseInningHalf(nextPhase.inningHalf),
  );

  const updated = await MatchModel.findOneAndUpdate(
    { id: matchId },
    {
      $set: {
        ...nextPhase,
        outsInHalf: 0,
        ...(overlay ? { liveScoreboard: overlay } : {}),
      },
      $unset: { pinchHitter: 1 },
    },
    { new: true },
  ).lean();

  if (!updated) throw new Error("경기를 찾을 수 없습니다.");
  return { match: updated as Match, predictionAutoStopped };
}

export async function getMatchInfo(matchId: string): Promise<Match | undefined> {
  const doc = await MatchModel.findOne({ id: matchId }).lean();
  return doc ? (doc as Match) : undefined;
}

export async function getPredictionsByMatchAndRound(
  matchId: string,
  roundNumber: number,
): Promise<Prediction[]> {
  const docs = await PredictionModel.find({ matchId, roundNumber }).lean();
  return docs as Prediction[];
}

export async function getUserPredictionByMatchRound(
  userId: string,
  matchId: string,
  roundNumber: number,
): Promise<Prediction | undefined> {
  const doc = await PredictionModel.findOne({ userId, matchId, roundNumber }).lean();
  return doc ? (doc as Prediction) : undefined;
}

export async function getLatestResolvedPredictionForMatch(
  userId: string,
  matchId: string,
): Promise<Prediction | undefined> {
  const doc = await PredictionModel.findOne({
    userId,
    matchId,
    status: { $in: ["success", "fail"] },
  })
    .sort({ roundNumber: -1 })
    .lean();
  return doc ? (doc as Prediction) : undefined;
}

export async function updateRoundPredictionResult(
  matchId: string,
  roundNumber: number,
  result: string,
): Promise<Map<string, number>> {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const existingStats = await RoundStatisticsModel.findOne({ matchId, roundNumber })
      .session(session)
      .lean();

    if (existingStats?.isResultSent) {
      throw new Error(`라운드 ${roundNumber}의 결과가 이미 전송되었습니다.`);
    }
    if (!existingStats || !existingStats.isPredictionStarted) {
      throw new Error(`라운드 ${roundNumber}의 예측이 아직 시작되지 않았습니다.`);
    }
    if (!existingStats.isPredictionStopped) {
      throw new Error(
        `라운드 ${roundNumber}의 예측이 아직 중지되지 않았습니다. 먼저 예측을 중지해주세요.`,
      );
    }

    const roundPredictions = await PredictionModel.find({ matchId, roundNumber })
      .session(session)
      .lean();

    if (roundPredictions.length === 0) {
      await RoundStatisticsModel.updateOne(
        roundStatsQuery(matchId, roundNumber),
        { isResultSent: true },
        { session },
      );
      await session.commitTransaction();
      return new Map<string, number>();
    }

    const winners = roundPredictions.filter((p) => p.prediction === result);
    const losers = roundPredictions.filter((p) => p.prediction !== result);
    const winnerCount = winners.length;

    for (const p of roundPredictions) {
      await PredictionModel.updateOne(
        { id: p.id },
        { result, status: p.prediction === result ? "success" : "fail" },
        { session },
      );
    }

    const userWonAmounts = new Map<string, number>();

    if (winnerCount > 0) {
      for (const winner of winners) {
        const payout = calculateFixedOddsPayout(winner.amount, result);
        userWonAmounts.set(winner.userId, payout);

        const updatedUser = await UserModel.findOneAndUpdate(
          { id: winner.userId },
          { $inc: { points: payout } },
          { new: true, session },
        ).lean();

        if (updatedUser) {
          await createPointTransaction(session, {
            userId: winner.userId,
            transactionType: "earned",
            amount: payout,
            balance: updatedUser.points,
            description: `라운드 ${roundNumber} 예측 성공 보상 (${winner.amount} × 배당, +${payout}포인트)`,
          });
        }

        await PredictionModel.updateOne({ id: winner.id }, { wonAmount: payout }, { session });
      }
    }

    for (const loser of losers) {
      if (!userWonAmounts.has(loser.userId)) {
        userWonAmounts.set(loser.userId, 0);
      }
    }

    const totalPool = roundPredictions.reduce((sum, p) => sum + p.amount, 0);
    await RoundStatisticsModel.updateOne(
      roundStatsQuery(matchId, roundNumber),
      {
        totalParticipants: roundPredictions.length,
        totalPoints: totalPool,
        totalWinners: winnerCount,
        isResultSent: true,
      },
      { session },
    );

    await session.commitTransaction();
    return userWonAmounts;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function getRoundStatistics(
  matchId: string,
  roundNumber: number,
): Promise<RoundStatistics | undefined> {
  const doc = await RoundStatisticsModel.findOne({ matchId, roundNumber }).lean();
  return doc ? (doc as RoundStatistics) : undefined;
}

export async function getAllRoundStatistics(matchId: string): Promise<RoundStatistics[]> {
  const docs = await RoundStatisticsModel.find({ matchId }).sort({ roundNumber: 1 }).lean();
  return docs as RoundStatistics[];
}

/** 예측 시작했으나 결과 미전송 — 다음 타자·공수교대·투수교체 불가 */
export async function assertRoundResultSentOrAllowAdvance(
  matchId: string,
  roundNumber: number,
): Promise<void> {
  const stats = await RoundStatisticsModel.findOne({ matchId, roundNumber }).lean();
  if (!stats) {
    throw new Error("먼저 예측을 시작하고 결과를 전송해 주세요.");
  }
  if (stats.isPredictionStarted && !stats.isPredictionStopped) {
    throw new Error("예측을 먼저 중지해 주세요.");
  }
  if (!stats.isResultSent) {
    throw new Error("먼저 예측 결과를 전송해 주세요.");
  }
}

/** 아웃 결과 시 공수 누적 아웃 +1 */
export async function incrementOutsInHalfOnResult(
  matchId: string,
  result: string,
): Promise<{ outsInHalf: number; threeOutsReached: boolean }> {
  if (result !== "아웃") {
    const doc = await MatchModel.findOne({ id: matchId }).select("outsInHalf").lean();
    const outsInHalf = (doc?.outsInHalf as number | undefined) ?? 0;
    return { outsInHalf, threeOutsReached: outsInHalf >= 3 };
  }
  const updated = await MatchModel.findOneAndUpdate(
    { id: matchId },
    { $inc: { outsInHalf: 1 } },
    { new: true },
  ).lean();
  const outsInHalf = (updated?.outsInHalf as number | undefined) ?? 0;
  return { outsInHalf, threeOutsReached: outsInHalf >= 3 };
}

export async function createOrUpdateRoundStatistics(
  matchId: string,
  roundNumber: number,
  totalParticipants: number,
  totalPoints: number,
  totalWinners: number,
): Promise<RoundStatistics> {
  const existing = await getRoundStatistics(matchId, roundNumber);

  if (existing) {
    const doc = await RoundStatisticsModel.findOneAndUpdate(
      roundStatsQuery(matchId, roundNumber),
      { totalParticipants, totalPoints, totalWinners },
      { new: true },
    ).lean();
    return doc as RoundStatistics;
  }

  const statsId = await getNextSequence("roundStatistics");
  const doc = await RoundStatisticsModel.create({
    id: statsId,
    matchId,
    roundNumber,
    totalParticipants,
    totalPoints,
    totalWinners,
  });
  return doc.toObject() as RoundStatistics;
}

export async function getRoundDetailsWithStatistics(matchId: string) {
  const allRoundStats = await getAllRoundStatistics(matchId);

  return Promise.all(
    allRoundStats.map(async (stats) => {
      const roundPredictions = await getPredictionsByMatchAndRound(matchId, stats.roundNumber);
      const result = roundPredictions.length > 0 ? roundPredictions[0].result : null;

      let distributedPoints = 0;
      if (stats.totalWinners > 0) {
        distributedPoints = roundPredictions
          .filter((p) => p.status === "success")
          .reduce((sum, p) => sum + Math.max(0, (p.wonAmount ?? 0) - p.amount), 0);
      }

      return {
        roundNumber: stats.roundNumber,
        totalParticipants: stats.totalParticipants,
        totalPoints: stats.totalPoints,
        totalWinners: stats.totalWinners,
        result,
        distributedPoints,
      };
    }),
  );
}

export async function getMatchOverallStatistics(matchId: string) {
  const match = await getMatchInfo(matchId);
  if (!match) throw new Error("경기를 찾을 수 없습니다.");

  const allRoundStats = await getAllRoundStatistics(matchId);
  const currentRoundPredictions = await getPredictionsByMatchAndRound(matchId, match.currentRound);

  let totalPredictors = 0;
  let totalPredictionPoints = 0;
  let totalWinners = 0;
  let totalDistributedPoints = 0;

  for (const stats of allRoundStats) {
    totalPredictors += stats.totalParticipants;
    totalPredictionPoints += stats.totalPoints;
    totalWinners += stats.totalWinners;

    if (stats.totalWinners > 0) {
      const roundPredictions = await getPredictionsByMatchAndRound(matchId, stats.roundNumber);
      totalDistributedPoints += roundPredictions
        .filter((p) => p.status === "success")
        .reduce((sum, p) => sum + Math.max(0, (p.wonAmount ?? 0) - p.amount), 0);
    }
  }

  const currentRoundParticipants = currentRoundPredictions.length;
  const currentRoundPoints = currentRoundPredictions.reduce((sum, p) => sum + p.amount, 0);

  return {
    totalPredictors: totalPredictors + currentRoundParticipants,
    totalPredictionPoints: totalPredictionPoints + currentRoundPoints,
    currentRound: match.currentRound,
    totalWinners,
    totalDistributedPoints,
    currentRoundParticipants,
    currentRoundPoints,
    predictionEnabled: match.predictionEnabled,
  };
}

export async function getVictoryRankings(
  page = 1,
  limit = 8,
  platform: MemberPlatform = "ppamong",
) {
  const MAX_RANK = 100;
  const offset = (page - 1) * limit;
  const platformMatch = buildUserPlatformMatchForAgg("user", platform);

  const allRankings = await PredictionModel.aggregate<{
    userId: string;
    username: string;
    name: string;
    email: string | null;
    victoryCount: number;
  }>([
    { $match: { status: "success" } },
    { $group: { _id: "$userId", victoryCount: { $sum: 1 } } },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    { $match: platformMatch },
    { $sort: { victoryCount: -1 } },
    { $limit: MAX_RANK },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        username: "$user.username",
        name: "$user.name",
        email: "$user.email",
        victoryCount: 1,
      },
    },
  ]);

  const total = allRankings.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (offset >= total) {
    return { data: [], total, page, limit, totalPages };
  }

  const data = allRankings.slice(offset, offset + limit);
  return { data, total, page, limit, totalPages };
}
