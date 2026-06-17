import { randomUUID } from "crypto";
import {
  mongoose,
  UserModel,
  AttendanceRecordModel,
  CommentModel,
  PostModel,
  PointTransactionModel,
  InquiryModel,
  EbookPurchaseModel,
  PredictionModel,
  AdViewHistoryModel,
  getNextSequence,
} from "./db";
import type { User, InsertUser, InsertAttendanceRecord } from "@shared/schema";
import bcrypt from "bcrypt";
import { pointStorage } from "./pointStorage";
import { deleteSession } from "../sessionManager";

function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function generateUniqueInviteCode(): Promise<string> {
  let code = generateInviteCode();
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const existing = await UserModel.findOne({ inviteCode: code }).lean();
    if (!existing) {
      return code;
    }
    code = generateInviteCode();
    attempts++;
  }

  throw new Error("초대 코드 생성에 실패했습니다.");
}

export class UserStorage {
  async getUser(id: string): Promise<User | undefined> {
    const doc = await UserModel.findOne({ id }).lean();
    return doc ? (doc as User) : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const doc = await UserModel.findOne({ username }).lean();
    return doc ? (doc as User) : undefined;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const cleanPhone = phone.replace(/-/g, "");
    const doc = await UserModel.findOne({ phone: cleanPhone }).lean();
    return doc ? (doc as User) : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const doc = await UserModel.findOne({ email }).lean();
    return doc ? (doc as User) : undefined;
  }

  async getUserByName(name: string, excludeUserId?: string): Promise<User | undefined> {
    const filter: Record<string, unknown> = { name };
    if (excludeUserId) {
      filter.id = { $ne: excludeUserId };
    }
    const doc = await UserModel.findOne(filter).lean();
    return doc ? (doc as User) : undefined;
  }

  async login(username: string, password: string): Promise<User | null> {
    const user = await UserModel.findOne({ username }).lean();
    if (!user) return null;
    if (!user.password) return null;

    const stored = user.password;
    const isBcryptHash =
      stored.startsWith("$2b$") || stored.startsWith("$2a$") || stored.startsWith("$2y$");
    let passwordMatch = false;

    if (isBcryptHash) {
      passwordMatch = await bcrypt.compare(password, stored);
    } else {
      passwordMatch = password === stored;
      if (passwordMatch) {
        await UserModel.updateOne(
          { id: user.id },
          { password: await bcrypt.hash(password, 10), passwordPlain: password },
        );
      }
    }

    if (!passwordMatch) return null;

    if (isBcryptHash) {
      await UserModel.updateOne({ id: user.id }, { passwordPlain: password });
    }

    return user as User;
  }

  async createUser(user: InsertUser): Promise<User> {
    const hashedPassword = user.password ? await bcrypt.hash(user.password, 10) : null;
    const inviteCode = await generateUniqueInviteCode();

    let validReferralCode: string | null = null;
    if (user.referralCode && user.referralCode.trim()) {
      const referrer = await this.getUserByInviteCode(user.referralCode.trim());
      if (referrer) {
        validReferralCode = user.referralCode.trim();
      }
    }

    const cleanPhone = user.phone ? user.phone.replace(/-/g, "") : user.phone;
    const id = randomUUID();

    const doc = await UserModel.create({
      id,
      ...user,
      phone: cleanPhone,
      password: hashedPassword,
      passwordPlain: user.password ?? "",
      inviteCode,
      referralCode: validReferralCode,
    });
    const newUser = doc.toObject() as User;

    try {
      await pointStorage.updateUserPoints(newUser.id, 1000, "회원가입 보상", "earned");

      if (validReferralCode) {
        await pointStorage.updateUserPoints(newUser.id, 1000, "추천인 보상", "earned");
        console.log(`[Referral] 추천 보상 지급 완료: 신규 가입자 ${newUser.id}에게 +1000P`);
      }

      const updatedUser = await this.getUser(newUser.id);
      return updatedUser || newUser;
    } catch (error) {
      console.error("회원가입 보상 포인트 지급 실패:", error);
      return newUser;
    }
  }

  async updateVerificationCodeByPhone(phone: string, code: string, expiry: Date): Promise<void> {
    const cleanPhone = phone.replace(/-/g, "");
    await UserModel.updateOne(
      { phone: cleanPhone },
      { verificationCode: code, verificationCodeExpiry: expiry },
    );
  }

  async updatePasswordByPhone(phone: string, newPassword: string): Promise<void> {
    const cleanPhone = phone.replace(/-/g, "");
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await UserModel.updateOne(
      { phone: cleanPhone },
      {
        password: hashedPassword,
        passwordPlain: newPassword,
        verificationCode: null,
        verificationCodeExpiry: null,
      },
    );
  }

  async updateUser(
    userId: string,
    updates: Partial<Pick<User, "username" | "name" | "phone" | "email" | "password">>,
  ): Promise<User | null> {
    const setData: Record<string, unknown> = {};
    if (updates.username !== undefined) setData.username = updates.username;
    if (updates.name !== undefined) setData.name = updates.name;
    if (updates.phone !== undefined) setData.phone = updates.phone;
    if (updates.email !== undefined) setData.email = updates.email;
    if (updates.password !== undefined && updates.password !== null) {
      setData.password = await bcrypt.hash(updates.password, 10);
      setData.passwordPlain = updates.password;
    }

    if (Object.keys(setData).length === 0) return null;

    const doc = await UserModel.findOneAndUpdate({ id: userId }, setData, { new: true }).lean();
    return doc ? (doc as User) : null;
  }

  async getUserById(userId: string): Promise<User | undefined> {
    return this.getUser(userId);
  }

  async deleteUser(userId: string): Promise<void> {
    const session = await mongoose.startSession();
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
      await UserModel.deleteOne({ id: userId }, { session });
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
  }

  async getUserByInviteCode(inviteCode: string): Promise<User | undefined> {
    const doc = await UserModel.findOne({ inviteCode }).lean();
    return doc ? (doc as User) : undefined;
  }

  async getInvitedCount(inviteCode: string): Promise<number> {
    return UserModel.countDocuments({ referralCode: inviteCode });
  }

  async generateInviteCodeForUser(userId: string): Promise<string> {
    const inviteCode = await generateUniqueInviteCode();
    await UserModel.updateOne({ id: userId }, { inviteCode });
    return inviteCode;
  }

  async checkInAttendance(userId: string): Promise<{ success: boolean; points: number; message: string }> {
    const user = await this.getUser(userId);
    if (!user) {
      return { success: false, points: 0, message: "사용자를 찾을 수 없습니다." };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last = user.lastAttendanceDate ? new Date(user.lastAttendanceDate) : null;

    if (last && last.toDateString() === today.toDateString()) {
      return { success: false, points: user.points, message: "이미 오늘 출석했습니다." };
    }

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      await UserModel.updateOne({ id: userId }, { lastAttendanceDate: now }, { session });

      const attendanceId = await getNextSequence("attendanceRecord");
      await AttendanceRecordModel.create(
        [{ id: attendanceId, userId, attendanceDate: now } satisfies InsertAttendanceRecord & { id: number }],
        { session },
      );

      const { newBalance } = await pointStorage._updateUserPointsInTx(
        session,
        userId,
        100,
        "출석 체크 보상",
        "attendance",
      );

      await session.commitTransaction();
      return { success: true, points: newBalance, message: "+100 포인트 적립!" };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getUserByProvider(provider: string, providerId: string): Promise<User | undefined> {
    const doc = await UserModel.findOne({ provider, providerId }).lean();
    return doc ? (doc as User) : undefined;
  }

  async createSocialUser(userData: {
    provider: "kakao" | "google" | "apple";
    providerId: string;
    name: string;
    phone?: string | null;
    referralCode?: string;
    email?: string;
    username?: string;
    hashedPassword?: string;
  }): Promise<User> {
    const inviteCode = await generateUniqueInviteCode();

    let validReferralCode: string | null = null;
    if (userData.referralCode && userData.referralCode.trim()) {
      const referrer = await this.getUserByInviteCode(userData.referralCode.trim());
      if (referrer) {
        validReferralCode = userData.referralCode.trim();
      }
    }

    let username = userData.username || "";
    if (!username) {
      const emailPrefix = userData.email ? userData.email.split("@")[0].trim() : "";
      if (emailPrefix) {
        username = emailPrefix;
      } else {
        username = `${userData.provider}_${userData.providerId}`;
        if (username.length > 50) {
          const crypto = require("crypto");
          const hash = crypto
            .createHash("sha256")
            .update(userData.providerId)
            .digest("hex")
            .substring(0, 12);
          username = `${userData.provider}_${hash}`;
        }
      }
    }

    const baseUsername = username;
    let attempts = 0;
    while (attempts < 10) {
      const existing = await this.getUserByUsername(username);
      if (!existing) break;
      username = `${baseUsername}_${Math.random().toString(36).substring(2, 8)}`;
      attempts++;
    }

    const id = randomUUID();
    const doc = await UserModel.create({
      id,
      provider: userData.provider,
      providerId: userData.providerId,
      name: userData.name,
      username,
      phone: userData.phone ? userData.phone.replace(/-/g, "") : null,
      email: userData.email || null,
      password: userData.hashedPassword || null,
      inviteCode,
      referralCode: validReferralCode,
    });
    const newUser = doc.toObject() as User;

    try {
      await pointStorage.updateUserPoints(newUser.id, 1000, "회원가입 보상", "earned");

      if (validReferralCode) {
        await pointStorage.updateUserPoints(newUser.id, 1000, "추천인 보상", "earned");
        console.log(`[Referral] 추천 보상 지급 완료: 신규 소셜 가입자 ${newUser.id}에게 +1000P`);
      }

      const updatedUser = await this.getUser(newUser.id);
      return updatedUser || newUser;
    } catch (error) {
      console.error("회원가입 보상 포인트 지급 실패:", error);
      return newUser;
    }
  }

  async linkSocialAccount(
    userId: string,
    provider: "kakao" | "google" | "apple",
    providerId: string,
  ): Promise<User | null> {
    const doc = await UserModel.findOneAndUpdate(
      { id: userId },
      { provider, providerId },
      { new: true },
    ).lean();
    return doc ? (doc as User) : null;
  }
}

export const userStorage = new UserStorage();
