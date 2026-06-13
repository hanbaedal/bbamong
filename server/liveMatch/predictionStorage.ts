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
import type { ClientSession } from "mongoose";

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

export async function updatePredictionWonAmount(predictionId: number, wonAmount: number): Promise<void> {
  await PredictionModel.updateOne({ id: predictionId }, { wonAmount });
}

export async function startRound(matchId: string): Promise<Match> {
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

    if (existing && existing.isPredictionStarted && !existing.isPredictionStopped) {
      await session.commitTransaction();
      return match as Match;
    }

    if (existing && existing.isResultSent) {
      throw new Error("결과가 이미 발송된 라운드는 재시작할 수 없습니다.");
    }

    const updatedMatch = await MatchModel.findOneAndUpdate(
      { id: matchId },
      { predictionEnabled: true },
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
        { id: existing.id },
        {
          predictionStartTime: new Date(),
          isPredictionStopped: false,
          totalParticipants: 0,
          totalPoints: 0,
          totalWinners: 0,
        },
        { session },
      );
    } else if (existing) {
      await RoundStatisticsModel.updateOne(
        { id: existing.id },
        { predictionStartTime: new Date(), isPredictionStarted: true },
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
    return updatedMatch as Match;
  } catch (error) {
    await session.abortTransaction();
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
    const existing = await RoundStatisticsModel.findOne({
      matchId,
      roundNumber: currentRound,
    })
      .session(session)
      .lean();

    if (!existing || !existing.isPredictionStarted) {
      throw new Error(`라운드 ${currentRound}의 예측이 아직 시작되지 않았습니다.`);
    }
    if (existing.isPredictionStopped) {
      throw new Error(`라운드 ${currentRound}의 예측이 이미 중지되었습니다.`);
    }

    const updatedMatch = await MatchModel.findOneAndUpdate(
      { id: matchId },
      { predictionEnabled: false },
      { new: true, session },
    ).lean();

    await RoundStatisticsModel.updateOne(
      { id: existing.id },
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
  force = false,
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

    let predictionAutoStopped = false;

    if (existing && !existing.isPredictionStopped) {
      if (!force) {
        throw new Error(
          `라운드 ${currentRound}의 예측이 아직 중지되지 않았습니다. 먼저 예측을 중지해주세요.`,
        );
      }
      console.log(`[nextRound] force=true: 라운드 ${currentRound} 예측 자동 중지 후 진행`);
      await RoundStatisticsModel.updateOne(
        { id: existing.id },
        { isPredictionStopped: true, predictionStopTime: new Date(), isResultSent: true },
        { session },
      );
      predictionAutoStopped = true;
    }

    if (!force && existing && !existing.isResultSent) {
      throw new Error(
        `라운드 ${currentRound}의 결과가 아직 전송되지 않았습니다. 먼저 결과를 전송해주세요.`,
      );
    }

    if (force && existing && !predictionAutoStopped && !existing.isResultSent) {
      console.log(
        `[nextRound] force=true: 라운드 ${currentRound} 결과 없이 강제 진행, isResultSent=true 마킹`,
      );
      await RoundStatisticsModel.updateOne({ id: existing.id }, { isResultSent: true }, { session });
    }

    const nextRoundNumber = currentRound + 1;
    const updatedMatch = await MatchModel.findOneAndUpdate(
      { id: matchId },
      { currentRound: nextRoundNumber, predictionEnabled: false },
      { new: true, session },
    ).lean();

    await session.commitTransaction();
    return { match: updatedMatch as Match, predictionAutoStopped };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
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
      await RoundStatisticsModel.updateOne({ id: existingStats.id }, { isResultSent: true }, { session });
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
      const losersPool = losers.reduce((sum, p) => sum + p.amount, 0);
      const rawShare = losersPool / winnerCount;
      const prize = Math.ceil(rawShare / 10) * 10;

      for (const winner of winners) {
        const payout = winner.amount + prize;
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
            description: `라운드 ${roundNumber} 예측 성공 보상 (상금 ${prize} + 원금 ${winner.amount})`,
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
      { id: existingStats.id },
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
      { id: existing.id },
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
        const winnersOriginalPoints = roundPredictions
          .filter((p) => p.status === "success")
          .reduce((sum, p) => sum + p.amount, 0);
        distributedPoints = stats.totalPoints - winnersOriginalPoints;
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
      const winnersOriginalPoints = roundPredictions
        .filter((p) => p.status === "success")
        .reduce((sum, p) => sum + p.amount, 0);
      totalDistributedPoints += stats.totalPoints - winnersOriginalPoints;
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

export async function getVictoryRankings(page = 1, limit = 8) {
  const MAX_RANK = 100;
  const offset = (page - 1) * limit;

  const allRankings = await PredictionModel.aggregate<{
    userId: string;
    victoryCount: number;
  }>([
    { $match: { status: "success" } },
    { $group: { _id: "$userId", victoryCount: { $sum: 1 } } },
    { $sort: { victoryCount: -1 } },
    { $limit: MAX_RANK },
    { $project: { userId: "$_id", victoryCount: 1, _id: 0 } },
  ]);

  const total = Math.min(allRankings.length, MAX_RANK);
  const totalPages = Math.ceil(MAX_RANK / limit);

  if (offset >= MAX_RANK) {
    return { data: [], total, page, limit, totalPages };
  }

  const pageSlice = allRankings.slice(offset, offset + limit);
  const data = await Promise.all(
    pageSlice.map(async (r) => {
      const user = await UserModel.findOne({ id: r.userId }).select("username name").lean();
      return {
        userId: r.userId,
        username: user?.username || "",
        name: user?.name || "",
        victoryCount: r.victoryCount,
      };
    }),
  );

  return { data, total, page, limit, totalPages };
}
