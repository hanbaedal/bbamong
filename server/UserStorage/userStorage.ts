import { db } from "./db";
import { users, attendanceRecords, pointTransactions, inquiries, posts, comments, ebookPurchases, predictions, adViewHistory } from "@shared/schema";
import { eq, and, ne } from "drizzle-orm";
import type { User, InsertUser, InsertAttendanceRecord } from "@shared/schema";
import bcrypt from "bcrypt";
import { pointStorage } from "./pointStorage";
import { deleteSession } from "../sessionManager";

// 초대 코드 생성 함수 (영문+숫자 6자리)
function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 유니크한 초대 코드 생성 (중복 체크)
async function generateUniqueInviteCode(): Promise<string> {
  let code = generateInviteCode();
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const existing = await db.select().from(users).where(eq(users.inviteCode, code));
    if (existing.length === 0) {
      return code;
    }
    code = generateInviteCode();
    attempts++;
  }
  
  throw new Error('초대 코드 생성에 실패했습니다.');
}


export class UserStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const cleanPhone = phone.replace(/-/g, "");
    const result = await db.select().from(users).where(eq(users.phone, cleanPhone));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async getUserByName(name: string, excludeUserId?: string): Promise<User | undefined> {
    if (excludeUserId) {
      const result = await db.select().from(users).where(
        and(eq(users.name, name), ne(users.id, excludeUserId))
      );
      return result[0];
    }
    const result = await db.select().from(users).where(eq(users.name, name));
    return result[0];
  }
  
  async login(username: string, password: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.username, username));
    const user = result[0];
    if (!user) return null;
    
    // 소셜 로그인 사용자인 경우 비밀번호 로그인 불가
    if (!user.password) return null;
    
    // bcrypt 비교
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return null;

    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    // 1. 비밀번호 해싱 (소셜 로그인이 아닌 경우만)
    const hashedPassword = user.password ? await bcrypt.hash(user.password, 10) : null;

    // 2. 유니크한 초대 코드 생성
    const inviteCode = await generateUniqueInviteCode();

    // 3. 추천인 코드 유효성 검사 (입력된 경우)
    let validReferralCode: string | null = null;
    if (user.referralCode && user.referralCode.trim()) {
      const referrer = await this.getUserByInviteCode(user.referralCode.trim());
      if (referrer) {
        validReferralCode = user.referralCode.trim();
      }
    }

    // 4. 전화번호 하이픈 제거 (숫자만 저장)
    const cleanPhone = user.phone ? user.phone.replace(/-/g, "") : user.phone;

    // 5. DB 저장
    const result = await db
      .insert(users)
      .values({ ...user, phone: cleanPhone, password: hashedPassword, inviteCode, referralCode: validReferralCode })
      .returning();

    const newUser = result[0];

    // 5. 회원가입 보상 1000 포인트 지급
    try {
      await pointStorage.updateUserPoints(
        newUser.id,
        1000,
        '회원가입 보상',
        'earned'
      );

      // 6. 추천인 코드가 유효한 경우 추가 1000 포인트 지급 (추천받은 사람에게)
      if (validReferralCode) {
        await pointStorage.updateUserPoints(
          newUser.id,
          1000,
          '추천인 보상',
          'earned'
        );
        console.log(`[Referral] 추천 보상 지급 완료: 신규 가입자 ${newUser.id}에게 +1000P`);
      }

      // 포인트 업데이트된 사용자 정보 다시 조회
      const updatedUser = await this.getUser(newUser.id);
      return updatedUser || newUser;
    } catch (error) {
      console.error('회원가입 보상 포인트 지급 실패:', error);
      return newUser;
    }
  }

  async updateVerificationCodeByPhone(phone: string, code: string, expiry: Date): Promise<void> {
    const cleanPhone = phone.replace(/-/g, "");
    await db
      .update(users)
      .set({ verificationCode: code, verificationCodeExpiry: expiry })
      .where(eq(users.phone, cleanPhone));
  }

  async updatePasswordByPhone(phone: string, newPassword: string): Promise<void> {
    const cleanPhone = phone.replace(/-/g, "");
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await db
      .update(users)
      .set({ password: hashedPassword, verificationCode: null, verificationCodeExpiry: null })
      .where(eq(users.phone, cleanPhone));
  }

  async updateUser(userId: string, updates: Partial<Pick<User, 'username' | 'name' | 'phone' | 'email' | 'password'>>): Promise<User | null> {
    const setData: any = {};
    if (updates.username !== undefined) setData.username = updates.username;
    if (updates.name !== undefined) setData.name = updates.name;
    if (updates.phone !== undefined) setData.phone = updates.phone;
    if (updates.email !== undefined) setData.email = updates.email;
    if (updates.password !== undefined) {
      setData.password = await bcrypt.hash(updates.password!, 10);
    }

    if (Object.keys(setData).length === 0) return null;

    const result = await db
      .update(users)
      .set(setData)
      .where(eq(users.id, userId))
      .returning();
    return result[0] || null;
  }

  async getUserById(userId: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, userId));
    return result[0];
  }

  async deleteUser(userId: string): Promise<void> {
    // 트랜잭션으로 모든 관련 데이터 삭제
    await db.transaction(async (tx) => {
      // 1. 댓글 삭제 (posts 삭제 전에 해야 함)
      await tx.delete(comments).where(eq(comments.authorId, userId));
      
      // 2. 게시물 삭제
      await tx.delete(posts).where(eq(posts.authorId, userId));
      
      // 3. 출석 기록 삭제
      await tx.delete(attendanceRecords).where(eq(attendanceRecords.userId, userId));
      
      // 4. 포인트 거래 내역 삭제
      await tx.delete(pointTransactions).where(eq(pointTransactions.userId, userId));
      
      // 5. 문의 내역 삭제
      await tx.delete(inquiries).where(eq(inquiries.userId, userId));
      
      // 6. 전자책 구매 내역 삭제
      await tx.delete(ebookPurchases).where(eq(ebookPurchases.userId, userId));
      
      // 7. 예측 기록 삭제
      await tx.delete(predictions).where(eq(predictions.userId, userId));
      
      // 8. 광고 시청 기록 삭제
      await tx.delete(adViewHistory).where(eq(adViewHistory.userId, userId));
      
      // 9. 마지막으로 유저 삭제
      await tx.delete(users).where(eq(users.id, userId));
    });
    
    // Redis 세션 삭제
    try {
      await deleteSession("user", userId);
    } catch (error) {
      console.error("Failed to delete user session:", error);
    }
  }

  async getUserByInviteCode(inviteCode: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.inviteCode, inviteCode));
    return result[0];
  }

  async getInvitedCount(inviteCode: string): Promise<number> {
    const result = await db.select().from(users).where(eq(users.referralCode, inviteCode));
    return result.length;
  }

  async generateInviteCodeForUser(userId: string): Promise<string> {
    const inviteCode = await generateUniqueInviteCode();
    await db.update(users).set({ inviteCode }).where(eq(users.id, userId));
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

    // 트랜잭션으로 출석 기록과 포인트 업데이트를 원자적으로 처리
    const result = await db.transaction(async (tx) => {
      // 1. 출석 날짜 업데이트
      await tx.update(users)
        .set({ lastAttendanceDate: now })
        .where(eq(users.id, userId));

      // 2. 출석 기록 생성
      await tx.insert(attendanceRecords)
        .values({ userId, attendanceDate: now } satisfies InsertAttendanceRecord);

      // 3. 포인트 업데이트 (pointStorage의 단일 소스 로직 재사용)
      const { newBalance } = await pointStorage._updateUserPointsInTx(
        tx,
        userId,
        100,
        '출석 체크 보상',
        'attendance'
      );

      return newBalance;
    });

    return { success: true, points: result, message: "+100 포인트 적립!" };
  }

  // 소셜 로그인 관련 메서드
  async getUserByProvider(provider: string, providerId: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(and(eq(users.provider, provider), eq(users.providerId, providerId)));
    return result[0];
  }

  async createSocialUser(userData: {
    provider: 'kakao' | 'google' | 'apple';
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
    
    let username = userData.username || '';
    if (!username) {
      const emailPrefix = userData.email ? userData.email.split('@')[0].trim() : '';
      if (emailPrefix) {
        username = emailPrefix;
      } else {
        username = `${userData.provider}_${userData.providerId}`;
        if (username.length > 50) {
          const crypto = require('crypto');
          const hash = crypto.createHash('sha256').update(userData.providerId).digest('hex').substring(0, 12);
          username = `${userData.provider}_${hash}`;
        }
      }
    }
    
    let baseUsername = username;
    let attempts = 0;
    while (attempts < 10) {
      const existing = await this.getUserByUsername(username);
      if (!existing) break;
      username = `${baseUsername}_${Math.random().toString(36).substring(2, 8)}`;
      attempts++;
    }

    const result = await db
      .insert(users)
      .values({
        provider: userData.provider,
        providerId: userData.providerId,
        name: userData.name,
        username,
        phone: userData.phone ? userData.phone.replace(/-/g, "") : null,
        email: userData.email || null,
        password: userData.hashedPassword || null,
        inviteCode,
        referralCode: validReferralCode,
      })
      .returning();

    const newUser = result[0];

    // 회원가입 보상 1000 포인트 지급
    try {
      await pointStorage.updateUserPoints(
        newUser.id,
        1000,
        '회원가입 보상',
        'earned'
      );

      // 추천인 코드가 유효한 경우 추가 1000 포인트 지급 (추천받은 사람에게)
      if (validReferralCode) {
        await pointStorage.updateUserPoints(
          newUser.id,
          1000,
          '추천인 보상',
          'earned'
        );
        console.log(`[Referral] 추천 보상 지급 완료: 신규 소셜 가입자 ${newUser.id}에게 +1000P`);
      }

      // 포인트 업데이트된 사용자 정보 다시 조회
      const updatedUser = await this.getUser(newUser.id);
      return updatedUser || newUser;
    } catch (error) {
      console.error('회원가입 보상 포인트 지급 실패:', error);
      return newUser;
    }
  }

  async linkSocialAccount(
    userId: string,
    provider: 'kakao' | 'google' | 'apple',
    providerId: string
  ): Promise<User | null> {
    const result = await db
      .update(users)
      .set({ provider, providerId })
      .where(eq(users.id, userId))
      .returning();
    return result[0] || null;
  }
}

export const userStorage = new UserStorage();
