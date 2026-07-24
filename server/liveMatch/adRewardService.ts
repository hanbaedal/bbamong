import type { ClientSession } from "mongoose";
import { mongoose, UserModel, PointTransactionModel, getNextSequence } from "../UserStorage/db";
import { getRedisClient } from "../redis";
import { AD_REWARD_POINTS } from "@shared/predictionOdds";

const REWARD_TTL_SECONDS = 60 * 60 * 6;

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

export async function grantAdRewardPoints(userId: string, matchId: string, rewardKey: string) {
  const redis = getRedisClient();
  const dedupeKey = `ad-reward:${matchId}:${userId}:${rewardKey}`;

  const alreadyGranted = await redis.get(dedupeKey);
  if (alreadyGranted) {
    throw new Error("이미 보상을 받았습니다.");
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const updatedUser = await UserModel.findOneAndUpdate(
      { id: userId },
      { $inc: { points: AD_REWARD_POINTS } },
      { new: true, session },
    ).lean();

    if (!updatedUser) throw new Error("사용자를 찾을 수 없습니다.");

    await createPointTransaction(session, {
      userId,
      transactionType: "earned",
      amount: AD_REWARD_POINTS,
      balance: updatedUser.points,
      description: `공수교대 광고 시청 보상 (+${AD_REWARD_POINTS}포인트)`,
    });

    await session.commitTransaction();
    await redis.set(dedupeKey, "1", "EX", REWARD_TTL_SECONDS);

    return {
      success: true,
      rewardPoints: AD_REWARD_POINTS,
      balance: updatedUser.points,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export function buildAdRewardKey(matchId: string, inningKey: string) {
  return `${matchId}:${inningKey}`;
}
