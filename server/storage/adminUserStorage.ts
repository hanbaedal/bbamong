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
import {
  type MemberPlatform,
  memberPlatformFilter,
  PPAMONG_MEMBER_MONGO_FILTER,
  BADMINTON9_MEMBER_MONGO_FILTER,
} from "../utils/memberPlatform";

export interface IAdminUserStorage {
  getRegularUsersPaginated(platform: MemberPlatform, limit: number, offset: number): Promise<User[]>;
  getSuspendedUsersPaginated(platform: MemberPlatform, limit: number, offset: number): Promise<User[]>;
  getRegularUsersCount(platform: MemberPlatform): Promise<number>;
  getRegularSuspendedUsersCount(platform: MemberPlatform): Promise<number>;
  getMemberPlatformCounts(): Promise<{ ppamong: number; badminton9: number }>;
  suspendUser(userId: string, isSuspended: boolean): Promise<User | undefined>;
  restoreUser(userId: string): Promise<User | undefined>;
  hardDeleteUser(userId: string): Promise<boolean>;
  getUserById(userId: string): Promise<User | undefined>;
}

export class AdminUserStorage implements IAdminUserStorage {
  private guestExclusion = { provider: { $ne: "guest" } };

  private activeFilter(platform: MemberPlatform) {
    return {
      ...memberPlatformFilter(platform),
      isSuspended: { $ne: 1 },
      ...this.guestExclusion,
    };
  }

  private suspendedFilter(platform: MemberPlatform) {
    return {
      ...memberPlatformFilter(platform),
      isSuspended: 1,
      ...this.guestExclusion,
    };
  }

  async getRegularUsersPaginated(platform: MemberPlatform, limit: number, offset: number): Promise<User[]> {
    const docs = await UserModel.find(this.activeFilter(platform))
      .sort({ createdAt: -1, lastLogin: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
    return docs as User[];
  }

  async getSuspendedUsersPaginated(platform: MemberPlatform, limit: number, offset: number): Promise<User[]> {
    const docs = await UserModel.find(this.suspendedFilter(platform))
      .sort({ suspendedAt: -1, createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
    return docs as User[];
  }

  async getRegularUsersCount(platform: MemberPlatform): Promise<number> {
    return UserModel.countDocuments(this.activeFilter(platform));
  }

  async getRegularSuspendedUsersCount(platform: MemberPlatform): Promise<number> {
    return UserModel.countDocuments(this.suspendedFilter(platform));
  }

  async getMemberPlatformCounts(): Promise<{ ppamong: number; badminton9: number }> {
    const [ppamong, badminton9] = await Promise.all([
      UserModel.countDocuments({ ...PPAMONG_MEMBER_MONGO_FILTER, ...this.guestExclusion, isSuspended: { $ne: 1 } }),
      UserModel.countDocuments({ ...BADMINTON9_MEMBER_MONGO_FILTER, ...this.guestExclusion, isSuspended: { $ne: 1 } }),
    ]);
    return { ppamong, badminton9 };
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
