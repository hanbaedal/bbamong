/**
 * 딜레이 광고 보상 — 실시간 adRewardService / Redis 키 `ad-reward:` 를 쓰지 않는다.
 */
import type { ClientSession } from "mongoose";
import { mongoose, UserModel, PointTransactionModel, getNextSequence } from "../UserStorage/db";
import { getRedisClient } from "../redis";
import { DELAY_AD_REWARD_POINTS } from "@shared/delayGame";

const REWARD_TTL_SECONDS = 60 * 60 * 6;

function delayAdDedupeKey(matchId: string, userId: string, rewardKey: string): string {
  return `delay-ad-reward:${matchId}:${userId}:${rewardKey}`;
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

export async function grantDelayAdRewardPoints(
  userId: string,
  matchId: string,
  rewardKey: string,
) {
  const redis = getRedisClient();
  const dedupeKey = delayAdDedupeKey(matchId, userId, rewardKey);

  const reserved = await redis.set(dedupeKey, "1", "EX", REWARD_TTL_SECONDS, "NX");
  if (!reserved) {
    throw new Error("이미 보상을 받았습니다.");
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const updatedUser = await UserModel.findOneAndUpdate(
      { id: userId },
      { $inc: { points: DELAY_AD_REWARD_POINTS } },
      { new: true, session },
    ).lean();

    if (!updatedUser) throw new Error("사용자를 찾을 수 없습니다.");

    await createPointTransaction(session, {
      userId,
      transactionType: "earned",
      amount: DELAY_AD_REWARD_POINTS,
      balance: updatedUser.points,
      description: `딜레이 광고 시청 보상 (+${DELAY_AD_REWARD_POINTS}포인트)`,
    });

    await session.commitTransaction();

    return {
      success: true,
      rewardPoints: DELAY_AD_REWARD_POINTS,
      balance: updatedUser.points,
    };
  } catch (error) {
    await session.abortTransaction();
    try {
      await redis.del(dedupeKey);
    } catch {
      /* ignore */
    }
    throw error;
  } finally {
    session.endSession();
  }
}
