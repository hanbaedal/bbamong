import {
  mongoose,
  UserModel,
  PointTransactionModel,
  getNextSequence,
} from "./db";
import type { ClientSession } from "mongoose";
import type { PointTransaction, InsertPointTransaction } from "@shared/schema";
import {
  type MemberPlatform,
  buildUserPlatformMatchForAgg,
} from "../utils/memberPlatform";

export class PointStorage {
  async _updateUserPointsInTx(
    session: ClientSession,
    userId: string,
    amount: number,
    description: string,
    transactionType: "earned" | "spent" | "donation" | "attendance",
  ): Promise<{ transaction: PointTransaction; newBalance: number }> {
    const user = await UserModel.findOneAndUpdate(
      { id: userId },
      { $inc: { points: amount } },
      { new: true, session },
    ).lean();

    if (!user) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }

    const newBalance = user.points;
    const txId = await getNextSequence("pointTransaction");
    const [transaction] = await PointTransactionModel.create(
      [
        {
          id: txId,
          userId,
          transactionType,
          amount,
          balance: newBalance,
          description,
        },
      ],
      { session },
    );

    return { transaction: transaction.toObject() as PointTransaction, newBalance };
  }

  async updateUserPoints(
    userId: string,
    amount: number,
    description: string,
    transactionType: "earned" | "spent" | "donation" | "attendance" = amount > 0 ? "earned" : "spent",
  ): Promise<{ transaction: PointTransaction; newBalance: number }> {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const result = await this._updateUserPointsInTx(
        session,
        userId,
        amount,
        description,
        transactionType,
      );
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getTransactionsByUser(
    userId: string,
    limit = 20,
    offset = 0,
  ): Promise<Array<PointTransaction & { userName: string }>> {
    const transactions = await PointTransactionModel.find({ userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const user = await UserModel.findOne({ id: userId }).select("name").lean();

    return transactions.map((row) => ({
      ...(row as PointTransaction),
      userName: user?.name || "Unknown",
    }));
  }

  async addTransaction(transaction: InsertPointTransaction): Promise<PointTransaction> {
    const lastTransaction = await PointTransactionModel.findOne({ userId: transaction.userId })
      .sort({ id: -1 })
      .select("balance")
      .lean();

    const previousBalance = lastTransaction?.balance || 0;
    const newBalance = previousBalance + transaction.amount;
    const id = await getNextSequence("pointTransaction");

    const doc = await PointTransactionModel.create({
      id,
      ...transaction,
      balance: newBalance,
    });
    return doc.toObject() as PointTransaction;
  }

  async getTransaction(id: number): Promise<PointTransaction | undefined> {
    const doc = await PointTransactionModel.findOne({ id }).lean();
    return doc ? (doc as PointTransaction) : undefined;
  }

  async getTotalPoints(userId: string): Promise<number> {
    const result = await PointTransactionModel.aggregate<{ total: number }>([
      { $match: { userId } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    return result[0]?.total || 0;
  }

  async deleteTransaction(id: number): Promise<{ success: boolean; message: string }> {
    const existing = await PointTransactionModel.findOne({ id }).lean();
    if (!existing) return { success: false, message: "거래를 찾을 수 없습니다." };

    await PointTransactionModel.deleteOne({ id });
    return { success: true, message: "거래가 삭제되었습니다." };
  }

  async getDonationsByUser(userId: string, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const [totalAgg, countResult, transactions, user] = await Promise.all([
      PointTransactionModel.aggregate<{ totalAmount: number }>([
        { $match: { userId, transactionType: "donation" } },
        { $group: { _id: null, totalAmount: { $sum: { $abs: "$amount" } } } },
      ]),
      PointTransactionModel.countDocuments({ userId, transactionType: "donation" }),
      PointTransactionModel.find({ userId, transactionType: "donation" })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      UserModel.findOne({ id: userId }).select("name").lean(),
    ]);

    const totalAmount = totalAgg[0]?.totalAmount || 0;
    const totalCount = countResult;

    return {
      donations: transactions.map((r) => ({
        ...(r as PointTransaction),
        amount: Math.abs(r.amount),
        userName: user?.name || "Unknown",
      })),
      totalAmount,
      totalCount,
    };
  }

  async getEarnedPointsRankings(
    page = 1,
    limit = 8,
    platform: MemberPlatform = "ppamong",
  ) {
    const offset = (page - 1) * limit;
    const MAX_RANK = 100;
    const platformMatch = buildUserPlatformMatchForAgg("user", platform);

    const allRankings = await PointTransactionModel.aggregate<{
      userId: string;
      username: string;
      name: string;
      email: string | null;
      earnedPoints: number;
    }>([
      { $match: { transactionType: "earned" } },
      { $group: { _id: "$userId", earnedPoints: { $sum: "$amount" } } },
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
      { $sort: { earnedPoints: -1 } },
      { $limit: MAX_RANK },
      {
        $project: {
          _id: 0,
          userId: "$_id",
          username: "$user.username",
          name: "$user.name",
          email: "$user.email",
          earnedPoints: 1,
        },
      },
    ]);

    const total = allRankings.length;
    const pageSlice = allRankings.slice(offset, offset + limit);

    return {
      data: pageSlice,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getDonationRankByUser(userId: string): Promise<{ rank: number; totalAmount: number }> {
    const totalAgg = await PointTransactionModel.aggregate<{ totalAmount: number }>([
      { $match: { userId, transactionType: "donation" } },
      { $group: { _id: null, totalAmount: { $sum: { $abs: "$amount" } } } },
    ]);
    const totalAmount = totalAgg[0]?.totalAmount || 0;

    const higherCount = await PointTransactionModel.aggregate<{ count: number }>([
      { $match: { transactionType: "donation" } },
      { $group: { _id: "$userId", donationTotal: { $sum: { $abs: "$amount" } } } },
      { $match: { donationTotal: { $gt: totalAmount } } },
      { $count: "count" },
    ]);

    const rank = (higherCount[0]?.count || 0) + 1;
    return { rank, totalAmount };
  }
}

export const pointStorage = new PointStorage();
