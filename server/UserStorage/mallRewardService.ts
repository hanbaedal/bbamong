import { mongoose, MallOrderModel } from "./db";
import { pointStorage } from "./pointStorage";
import { calculateMallRewardPoints } from "@shared/mallRewards";

/** 택배 인계(shipped) 시 1회만 게임 포인트 적립 */
export async function grantMallOrderRewardPoints(orderId: number): Promise<{
  granted: boolean;
  points: number;
  newBalance?: number;
}> {
  const pointsPreview = async (): Promise<number> => {
    const order = await MallOrderModel.findOne({ id: orderId }).lean();
    if (!order || order.status !== "shipped") return 0;
    return calculateMallRewardPoints(order.totalAmount ?? 0);
  };

  const points = await pointsPreview();
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const claimed = await MallOrderModel.findOneAndUpdate(
      {
        id: orderId,
        status: "shipped",
        rewardPointsGranted: { $ne: true },
      },
      {
        rewardPointsGranted: true,
        rewardPointsAmount: points,
        updatedAt: new Date(),
      },
      { new: true, session },
    ).lean();

    if (!claimed) {
      await session.abortTransaction();
      return { granted: false, points: 0 };
    }

    if (points <= 0) {
      await session.commitTransaction();
      return { granted: false, points: 0 };
    }

    const { newBalance } = await pointStorage._updateUserPointsInTx(
      session,
      String(claimed.userId),
      points,
      `쇼핑센터 구매 적립 (주문 #${orderId})`,
      "earned",
    );

    await session.commitTransaction();
    return { granted: true, points, newBalance };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
