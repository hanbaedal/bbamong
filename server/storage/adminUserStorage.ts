import {
  mongoose,
  UserModel,
  CommentModel,
  PostModel,
  AttendanceRecordModel,
  PointTransactionModel,
  InquiryModel,
  EbookPurchaseModel,
  PredictionModel,
  AdViewHistoryModel,
} from "../UserStorage/db";
import type { User } from "@shared/schema";
import { deleteSession } from "../sessionManager";

export interface IAdminUserStorage {
  getRegularUsersPaginated(limit: number, offset: number): Promise<User[]>;
  getRegularUsersCount(): Promise<number>;
  getRegularSuspendedUsersCount(): Promise<number>;
  suspendUser(userId: string, isSuspended: boolean): Promise<User | undefined>;
  restoreUser(userId: string): Promise<User | undefined>;
  hardDeleteUser(userId: string): Promise<boolean>;
  getUserById(userId: string): Promise<User | undefined>;
}

export class AdminUserStorage implements IAdminUserStorage {
  private baseFilter = { isSuspended: 0, provider: { $ne: "guest" } };
  private suspendedFilter = { isSuspended: 1, provider: { $ne: "guest" } };

  async getRegularUsersPaginated(limit: number, offset: number): Promise<User[]> {
    const docs = await UserModel.find(this.baseFilter)
      .sort({ lastLogin: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
    return docs as User[];
  }

  async getSuspendedUsersPaginated(limit: number, offset: number): Promise<User[]> {
    const docs = await UserModel.find(this.suspendedFilter)
      .sort({ lastLogin: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
    return docs as User[];
  }

  async getRegularUsersCount(): Promise<number> {
    return UserModel.countDocuments(this.baseFilter);
  }

  async getRegularSuspendedUsersCount(): Promise<number> {
    return UserModel.countDocuments(this.suspendedFilter);
  }

  async suspendUser(userId: string, isSuspended: boolean): Promise<User | undefined> {
    const update: Record<string, unknown> = {
      isSuspended: isSuspended ? 1 : 0,
      suspendedAt: isSuspended ? new Date() : null,
    };
    if (isSuspended) {
      update.lastLogout = new Date();
    }

    const doc = await UserModel.findOneAndUpdate({ id: userId }, update, { new: true }).lean();
    return doc ? (doc as User) : undefined;
  }

  async getUserById(userId: string): Promise<User | undefined> {
    const doc = await UserModel.findOne({ id: userId }).lean();
    return doc ? (doc as User) : undefined;
  }

  async restoreUser(userId: string): Promise<User | undefined> {
    const doc = await UserModel.findOneAndUpdate(
      { id: userId },
      { isSuspended: 0, suspendedAt: null },
      { new: true },
    ).lean();
    return doc ? (doc as User) : undefined;
  }

  async hardDeleteUser(userId: string): Promise<boolean> {
    const session = await mongoose.startSession();
    let deleted = false;
    try {
      session.startTransaction();
      await CommentModel.deleteMany({ authorId: userId }, { session });
      await PostModel.deleteMany({ authorId: userId }, { session });
      await AttendanceRecordModel.deleteMany({ userId }, { session });
      await PointTransactionModel.deleteMany({ userId }, { session });
      await InquiryModel.deleteMany({ userId }, { session });
      await EbookPurchaseModel.deleteMany({ userId }, { session });
      await PredictionModel.deleteMany({ userId }, { session });
      await AdViewHistoryModel.deleteMany({ userId }, { session });
      const result = await UserModel.deleteOne({ id: userId }, { session });
      deleted = result.deletedCount > 0;
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    try {
      await deleteSession("user", userId);
    } catch (error) {
      console.error("Failed to delete user session:", error);
    }

    return deleted;
  }
}
