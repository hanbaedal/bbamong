import type { Express, Request, Response } from "express";
import { userStorage as storage } from "../UserStorage/userStorage"
import { attendanceStorage as attendanceStorage } from "../UserStorage/attendanceStorage"
import { db } from "../UserStorage/db";
import { users, predictions, matches, stadiums, adViewHistory, advertisements, pointTransactions } from "@shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";

import { insertUserSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { generateUserAccessToken, generateUserRefreshToken, verifyUserRefreshToken } from "../utils/jwt";
import { userAuthMiddleware, type AuthenticatedUserRequest } from "../middleware/userAuth";
import { hasActiveSession, createSession, deleteSession } from "../sessionManager";
import { getRedisClient } from "../redis";

export async function userRoutes(app: Express): Promise<void> {
  // 아이디 중복 확인
  app.post("/api/check-username", async (req, res) => {
    try {
      const { username, excludeUserId } = req.body;

      if (!username) {
        return res.status(400).json({ error: "아이디를 입력해주세요." });
      }

      const existingUser = await storage.getUserByUsername(username);

      if (existingUser && existingUser.id !== excludeUserId) {
        return res.json({ available: false, message: "이미 사용 중인 아이디입니다." });
      }

      return res.json({ available: true, message: "사용 가능한 아이디입니다." });
    } catch (error) {
      console.error("Username check error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 닉네임(이름) 중복 확인
  app.post("/api/check-nickname", async (req, res) => {
    try {
      const { name, userId } = req.body;

      if (!name) {
        return res.status(400).json({ error: "닉네임을 입력해주세요." });
      }

      if (!name.trim()) {
        return res.json({ available: false, message: "닉네임을 입력해주세요." });
      }

      const existingUser = await storage.getUserByName(name.trim(), userId);

      if (existingUser) {
        return res.json({ available: false, message: "이미 사용중인 닉네임입니다." });
      }

      return res.json({ available: true, message: "사용 가능한 닉네임입니다." });
    } catch (error) {
      console.error("Nickname check error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 이메일 중복 확인 (users 테이블 체크 - 일반 유저용)
  app.post("/api/check-email", async (req, res) => {
    try {
      const { email, excludeUserId } = req.body;

      if (!email) {
        return res.status(400).json({ error: "이메일을 입력해주세요." });
      }

      if (!email.trim()) {
        return res.json({ available: false, message: "이메일을 입력해주세요." });
      }

      const allUsersWithEmail = await db.select().from(users).where(eq(users.email, email.trim()));
      const otherUser = allUsersWithEmail.find(u => u.id !== excludeUserId);

      if (otherUser) {
        return res.json({ available: false, message: "이미 사용 중인 이메일입니다." });
      }

      return res.json({ available: true, message: "사용 가능한 이메일입니다." });
    } catch (error) {
      console.error("Email check error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 회원가입
  app.post("/api/signup", async (req, res) => {
    try {
      const result = insertUserSchema.safeParse(req.body);

      if (!result.success) {
        const error = fromZodError(result.error);
        return res.status(400).json({ error: error.message });
      }

      const { username, phone } = result.data;
      const cleanPhone = phone ? phone.replace(/-/g, "") : phone;

      // 전화번호 인증 확인
      if (cleanPhone) {
        const redis = getRedisClient();
        const verifiedKey = `phone_verified:${cleanPhone}`;
        const isPhoneVerified = await redis.get(verifiedKey);
        
        if (!isPhoneVerified) {
          return res.status(400).json({ error: "전화번호 인증을 완료해주세요." });
        }
        
        // 인증 완료 후 Redis에서 인증 플래그 삭제 (재사용 방지)
        await redis.del(verifiedKey);
      }

      // 아이디 중복 확인
      const existingUserByUsername = await storage.getUserByUsername(username);
      if (existingUserByUsername) {
        if (existingUserByUsername.isSuspended === 1) {
          return res.status(400).json({ error: "탈퇴된 계정입니다. 복구를 원하시면 고객센터로 문의해주세요." });
        }
        return res.status(400).json({ error: "이미 사용 중인 아이디입니다." });
      }

      // 전화번호 중복 확인
      const existingUserByPhone = await storage.getUserByPhone(cleanPhone || "");
      if (existingUserByPhone) {
        if (existingUserByPhone.isSuspended === 1) {
          return res.status(400).json({ error: "탈퇴된 계정입니다. 복구를 원하시면 고객센터로 문의해주세요." });
        }
        return res.status(400).json({ error: "이미 사용 중인 전화번호입니다." });
      }

      const user = await storage.createUser({ ...result.data, phone: cleanPhone || result.data.phone });

      // 비밀번호는 응답에서 제외
      const { password, ...userWithoutPassword } = user;

      return res.status(201).json({ 
        success: true, 
        message: "회원가입이 완료되었습니다.",
        user: userWithoutPassword 
      });
    } catch (error) {
      console.error("Signup error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.post("/api/verify-identity", userAuthMiddleware, async (req: AuthenticatedUserRequest, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "아이디와 비밀번호를 입력해 주세요." });
      }

      const currentUser = await storage.getUserById(req.user!.userId);
      if (!currentUser) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }

      if (!currentUser.username || !currentUser.password) {
        return res.status(400).json({ error: "아이디 또는 비밀번호가 설정되지 않았습니다." });
      }

      if (currentUser.username !== username.trim()) {
        return res.status(401).json({ error: "아이디 또는 비밀번호가 일치하지 않습니다." });
      }

      const bcrypt = await import("bcrypt");
      const isValid = await bcrypt.compare(password, currentUser.password);
      if (!isValid) {
        return res.status(401).json({ error: "아이디 또는 비밀번호가 일치하지 않습니다." });
      }

      return res.json({ verified: true });
    } catch (error) {
      return res.status(500).json({ error: "본인 확인 중 오류가 발생했습니다." });
    }
  });

  // 로그인 (모바일 앱용 - JWT Bearer Token 방식)
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "아이디와 비밀번호를 입력해주세요." });
      }

      const user = await storage.login(username, password);

      if (!user) {
        return res.status(401).json({ error: "아이디 또는 비밀번호가 잘못되어 있습니다." });
      }

      // 정지된 계정 체크
      if (user.isSuspended === 1) {
        return res.status(403).json({ error: "suspended", message: "삭제된 계정입니다. 관리자한테 문의 주세요." });
      }

      const hasSession = await hasActiveSession("user", user.id);
      if (hasSession) {
        console.log(`[User Login] 기존 세션 강제 교체: ${user.id}`);
        await deleteSession("user", user.id);
      }

      // JWT 토큰 생성
      const tokenPayload = {
        userId: user.id,
        username: user.username,
      };

      const accessToken = generateUserAccessToken(tokenPayload);
      const refreshToken = generateUserRefreshToken(tokenPayload);

      // lastLogin, lastActive 동시 업데이트
      const now = new Date();
      await db.update(users).set({ lastLogin: now, lastActive: now }).where(eq(users.id, user.id));

      // Redis 세션 생성
      await createSession("user", user.id, {
        username: user.username,
      });

      // 비밀번호는 응답에서 제외
      const { password: _, ...userWithoutPassword } = user;

      // 모바일 앱용: JSON으로 토큰 반환 (쿠키 사용 안함)
      return res.json({ 
        success: true, 
        message: "로그인 성공",
        accessToken,
        refreshToken,
        user: userWithoutPassword,
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.post("/api/guest-login", async (req, res) => {
    try {
      const { guestId } = req.body || {};
      let user;

      if (guestId) {
        const existingUser = await storage.getUserById(guestId);
        if (existingUser && existingUser.provider === "guest") {
          if (existingUser.isSuspended === 1) {
            console.log(`[Guest Login] Suspended guest account ${guestId}, creating new guest`);
          } else {
            const hasSession = await hasActiveSession("user", existingUser.id);
            if (hasSession) {
              await deleteSession("user", existingUser.id);
            }
            user = existingUser;
          }
        }
      }

      if (!user) {
        const { randomUUID } = await import("crypto");
        const guestUsername = `guest_${randomUUID().replace(/-/g, '').slice(0, 12)}`;

        user = await storage.createUser({
          username: guestUsername,
          name: "guest",
          provider: "guest",
          password: undefined,
          phone: undefined,
          email: undefined,
          referralCode: undefined,
          verificationCode: undefined,
          verificationCodeExpiry: undefined,
        });

        if (user.isSuspended === 1) {
          return res.status(403).json({ error: "suspended", message: "삭제된 계정입니다. 관리자한테 문의 주세요." });
        }
      }

      const tokenPayload = {
        userId: user.id,
        username: user.username,
      };

      const accessToken = generateUserAccessToken(tokenPayload);
      const refreshToken = generateUserRefreshToken(tokenPayload);

      const now = new Date();
      await db.update(users).set({ lastLogin: now, lastActive: now }).where(eq(users.id, user.id));

      await createSession("user", user.id, {
        username: user.username,
      });

      const { password: _, ...userWithoutPassword } = user;

      return res.json({
        success: true,
        message: "게스트 로그인 성공",
        accessToken,
        refreshToken,
        user: userWithoutPassword,
      });
    } catch (error) {
      console.error("Guest login error:", error);
      return res.status(500).json({ error: "게스트 로그인 중 오류가 발생했습니다." });
    }
  });

  // 비밀번호 찾기 - 전화번호 확인 및 인증번호 전송
  app.post("/api/password-reset/send-code", async (req, res) => {
    try {
      const { phone } = req.body;

      if (!phone) {
        return res.status(400).json({ error: "전화번호를 입력해주세요." });
      }

      const cleanPhone = phone.replace(/-/g, "");
      
      if (!/^01[0-9]{8,9}$/.test(cleanPhone)) {
        return res.status(400).json({ error: "올바른 전화번호 형식이 아닙니다." });
      }

      const user = await storage.getUserByPhone(cleanPhone);
      if (!user) {
        return res.status(404).json({ error: "등록되지 않은 전화번호입니다." });
      }

      // 6자리 랜덤 인증번호 생성
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      // 인증번호 유효기간: 3분
      const expiry = new Date();
      expiry.setMinutes(expiry.getMinutes() + 3);

      await storage.updateVerificationCodeByPhone(cleanPhone, verificationCode, expiry);

      // SMS 발송 (phoneVerificationRoutes.ts의 로직 재사용)
      const crypto = await import("crypto");
      const https = await import("https");
      
      const SOLAPI_HOST = "api.solapi.com";
      const apiKey = process.env.SOLAPI_API_KEY || "";
      const apiSecret = process.env.SOLAPI_API_SECRET || "";
      const senderPhone = process.env.SOLAPI_SENDER_PHONE || "01049961316";
      
      const date = new Date().toISOString();
      const salt = crypto.randomBytes(32).toString("hex");
      const signature = crypto.createHmac("sha256", apiSecret).update(date + salt).digest("hex");
      const authHeader = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
      
      const message = { to: cleanPhone, from: senderPhone, text: `[비밀번호 재설정] 인증번호: ${verificationCode}\n유효시간 3분` };
      const body = Buffer.from(JSON.stringify({ message }), "utf8");
      
      const sendSMS = () => new Promise<void>((resolve, reject) => {
        const req = https.request(
          { hostname: SOLAPI_HOST, port: 443, method: "POST", path: "/messages/v4/send", headers: { Authorization: authHeader, "Content-Type": "application/json", "Content-Length": body.length }, timeout: 15000 },
          (res) => {
            let data = "";
            res.on("data", (c) => (data += c));
            res.on("end", () => {
              try {
                const json = JSON.parse(data || "{}");
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300 && json.groupId) {
                  resolve();
                } else {
                  reject(new Error(`SMS_SEND_FAILED: ${data}`));
                }
              } catch (e) {
                reject(e);
              }
            });
          }
        );
        req.on("timeout", () => req.destroy(new Error("REQUEST_TIMEOUT")));
        req.on("error", (e) => reject(e));
        req.write(body.toString());
        req.end();
      });
      
      try {
        await sendSMS();
        console.log(`[비밀번호 재설정] 인증번호 ${verificationCode}가 ${cleanPhone}로 전송되었습니다.`);
      } catch (smsError) {
        console.error("SMS 전송 실패:", smsError);
        if (!apiKey || !apiSecret) {
          console.log(`[개발모드] 비밀번호 재설정 인증번호: ${verificationCode} (전화번호: ${cleanPhone})`);
        } else {
          return res.status(500).json({ error: "SMS 전송에 실패했습니다. 잠시 후 다시 시도해주세요." });
        }
      }

      return res.json({ 
        success: true, 
        message: "인증번호가 전송되었습니다.",
        expiresIn: 180
      });
    } catch (error) {
      console.error("Send code error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 비밀번호 찾기 - 인증번호 확인
  app.post("/api/password-reset/verify-code", async (req, res) => {
    try {
      const { phone, code } = req.body;

      if (!phone || !code) {
        return res.status(400).json({ error: "전화번호와 인증번호를 입력해주세요." });
      }

      const cleanPhone = phone.replace(/-/g, "");
      const user = await storage.getUserByPhone(cleanPhone);
      if (!user) {
        return res.status(404).json({ error: "등록되지 않은 전화번호입니다." });
      }

      if (!user.verificationCode) {
        return res.status(400).json({ error: "인증번호를 먼저 요청해주세요." });
      }

      if (user.verificationCode !== code) {
        return res.status(400).json({ error: "인증번호가 일치하지 않습니다." });
      }

      if (!user.verificationCodeExpiry || user.verificationCodeExpiry < new Date()) {
        return res.status(400).json({ error: "인증번호가 만료되었습니다. 다시 요청해주세요." });
      }

      return res.json({ 
        success: true, 
        message: "인증번호가 확인되었습니다."
      });
    } catch (error) {
      console.error("Verify code error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 비밀번호 찾기 - 비밀번호 재설정
  app.post("/api/password-reset/reset", async (req, res) => {
    try {
      const { phone, code, newPassword } = req.body;

      if (!phone || !code || !newPassword) {
        return res.status(400).json({ error: "모든 필드를 입력해주세요." });
      }

      if (newPassword.length < 8 || newPassword.length > 20) {
        return res.status(400).json({ error: "비밀번호는 8~20자로 입력해주세요." });
      }

      const cleanPhone = phone.replace(/-/g, "");
      const user = await storage.getUserByPhone(cleanPhone);
      if (!user) {
        return res.status(404).json({ error: "등록되지 않은 전화번호입니다." });
      }

      if (!user.verificationCode || user.verificationCode !== code) {
        return res.status(400).json({ error: "인증번호가 일치하지 않습니다." });
      }

      if (!user.verificationCodeExpiry || user.verificationCodeExpiry < new Date()) {
        return res.status(400).json({ error: "인증번호가 만료되었습니다. 다시 요청해주세요." });
      }

      await storage.updatePasswordByPhone(cleanPhone, newPassword);

      return res.json({ 
        success: true, 
        message: "비밀번호가 재설정되었습니다."
      });
    } catch (error) {
      console.error("Reset password error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 사용자 정보 수정
  app.patch("/api/users/:id", userAuthMiddleware, async (req: AuthenticatedUserRequest, res: Response) => {
    try {
      const userId = req.params.id;

      if (req.user!.userId !== userId) {
        return res.status(403).json({ error: "본인의 정보만 수정할 수 있습니다." });
      }

      const { username, name, phone, email, password, confirmPassword } = req.body;

      if (!username && !name && !phone && !email && !password) {
        return res.status(400).json({ error: "수정할 정보를 입력해주세요." });
      }

      if (username) {
        const existingByUsername = await storage.getUserByUsername(username.trim());
        if (existingByUsername && existingByUsername.id !== userId) {
          return res.status(400).json({ error: "이미 사용 중인 아이디입니다." });
        }
      }

      if (password) {
        if (password.length < 8) {
          return res.status(400).json({ error: "비밀번호는 최소 8자 이상이어야 합니다." });
        }
        if (password !== confirmPassword) {
          return res.status(400).json({ error: "비밀번호가 일치하지 않습니다." });
        }
      }

      if (phone) {
        const cleanPhone = phone.replace(/-/g, "");
        const redis = getRedisClient();
        const verifiedKey = `phone_verified:${cleanPhone}`;
        const isPhoneVerified = await redis.get(verifiedKey);

        if (!isPhoneVerified) {
          return res.status(400).json({ error: "전화번호 인증을 완료해주세요." });
        }

        const existingByPhone = await storage.getUserByPhone(cleanPhone);
        if (existingByPhone && existingByPhone.id !== userId) {
          return res.status(400).json({ error: "이미 사용 중인 전화번호입니다." });
        }

        await redis.del(verifiedKey);
      }

      if (email) {
        const existingByEmail = await storage.getUserByEmail(email);
        if (existingByEmail && existingByEmail.id !== userId) {
          return res.status(400).json({ error: "이미 사용 중인 이메일입니다." });
        }
      }

      const updates: Partial<{ username: string; name: string; phone: string; email: string; password: string }> = {};
      if (username) updates.username = username.trim();
      if (name) updates.name = name;
      if (phone) updates.phone = phone.replace(/-/g, "");
      if (email) updates.email = email;
      if (password) updates.password = password;

      const updatedUser = await storage.updateUser(userId, updates);

      if (!updatedUser) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }

      const { password: _, ...userWithoutPassword } = updatedUser;

      return res.json({
        success: true,
        message: "회원정보가 수정되었습니다.",
        user: {
          ...userWithoutPassword,
          hasPassword: !!updatedUser.password,
        },
      });
    } catch (error) {
      console.error("Update user error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/users/social-pending/:code", async (req: Request, res: Response) => {
    try {
      const { code } = req.params;
      if (!code) {
        return res.status(400).json({ error: "코드가 없습니다." });
      }
      const socialData = await getSocialPendingData(code);
      if (!socialData) {
        return res.status(404).json({ error: "소셜 인증 정보가 만료되었습니다." });
      }
      return res.json({
        name: socialData.name || "",
        email: socialData.email || "",
        phone: socialData.phone || "",
      });
    } catch (error) {
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 소셜 온보딩 - 소셜 로그인 후 추가 정보 입력 (계정 생성)
  app.post("/api/users/social-onboarding", async (req: Request, res: Response) => {
    try {
      const { pendingCode, username, name, password, confirmPassword, email, phone, referralCode } = req.body;

      if (!pendingCode) {
        return res.status(400).json({ error: "인증 정보가 없습니다. 소셜 로그인을 다시 시도해주세요." });
      }

      const { getSocialPendingData, deleteSocialPendingData } = await import("./socialAuthRoutes");
      const socialData = await getSocialPendingData(pendingCode);
      if (!socialData) {
        return res.status(400).json({ error: "인증 정보가 만료되었습니다. 소셜 로그인을 다시 시도해주세요." });
      }

      if (!username || !name || !password || !email || !phone) {
        return res.status(400).json({ error: "모든 필수 항목을 입력해주세요." });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: "비밀번호는 최소 8자 이상이어야 합니다." });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ error: "비밀번호가 일치하지 않습니다." });
      }

      const existingByUsername = await storage.getUserByUsername(username.trim());
      if (existingByUsername) {
        return res.status(400).json({ error: "이미 사용 중인 아이디입니다." });
      }

      const existingByEmail = await storage.getUserByEmail(email.trim());
      if (existingByEmail) {
        return res.status(400).json({ error: "이미 사용 중인 이메일입니다." });
      }

      const cleanPhone = phone.replace(/-/g, "");
      const redis = getRedisClient();
      const verifiedKey = `phone_verified:${cleanPhone}`;
      const isPhoneVerified = await redis.get(verifiedKey);

      if (!isPhoneVerified) {
        return res.status(400).json({ error: "전화번호 인증을 완료해주세요." });
      }

      const existingByPhone = await storage.getUserByPhone(cleanPhone);
      if (existingByPhone) {
        return res.status(400).json({ error: "이미 사용 중인 전화번호입니다." });
      }

      await redis.del(verifiedKey);

      const existingByProvider = await storage.getUserByProvider(socialData.provider, socialData.providerId);
      if (existingByProvider) {
        await deleteSocialPendingData(pendingCode);
        return res.status(400).json({ error: "이미 가입된 계정입니다. 로그인을 시도해주세요." });
      }

      const bcrypt = await import("bcrypt");
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await storage.createSocialUser({
        provider: socialData.provider,
        providerId: socialData.providerId,
        name: name.trim(),
        phone: cleanPhone,
        email: email.trim(),
        username: username.trim(),
        hashedPassword,
        referralCode: referralCode?.trim() || undefined,
      });

      await deleteSocialPendingData(pendingCode);

      const tokenPayload = {
        userId: user.id,
        username: username.trim(),
      };

      const jwtAccessToken = generateUserAccessToken(tokenPayload);
      const jwtRefreshToken = generateUserRefreshToken(tokenPayload);

      await createSession("user", user.id, {
        username: username.trim(),
      });

      const now = new Date();
      await db.update(users).set({ lastLogin: now, lastActive: now }).where(eq(users.id, user.id));

      const updatedUser = await storage.getUser(user.id);
      const { password: _, ...userWithoutPassword } = updatedUser || user;

      return res.json({
        success: true,
        message: "회원가입이 완료되었습니다.",
        accessToken: jwtAccessToken,
        refreshToken: jwtRefreshToken,
        user: {
          ...userWithoutPassword,
          hasPassword: true,
        },
      });
    } catch (error) {
      console.error("Social onboarding error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 회원 탈퇴 (인증 필요 - 본인만 탈퇴 가능)
  app.delete("/api/users/me", userAuthMiddleware, async (req: AuthenticatedUserRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      const existingUser = await storage.getUserById(userId);

      if (!existingUser) {
        return res
          .status(404)
          .json({ error: "사용자를 찾을 수 없습니다." });
      }

      await db
        .update(users)
        .set({ isSuspended: 1, suspendedAt: new Date(), lastLogout: new Date() })
        .where(eq(users.id, userId));

      try {
        await deleteSession("user", userId);
      } catch (sessionError) {
        console.error("세션 삭제 실패:", sessionError);
      }

      return res.json({ 
        success: true, 
        message: "회원 탈퇴가 완료되었습니다. 2년 후 계정이 완전히 삭제됩니다." 
      });
    } catch (error) {
      console.error("Delete user error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // Refresh token으로 access token 재발급 (모바일 앱용 - Bearer Token 방식)
  app.post("/api/users/refresh", async (req, res) => {
    try {
      // 요청 body에서 refreshToken 받기
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({ error: "Refresh token이 없습니다." });
      }

      const decoded = verifyUserRefreshToken(refreshToken);

      const user = await storage.getUserByUsername(decoded.username);
      if (!user) {
        return res.status(401).json({ error: "유효하지 않은 사용자입니다." });
      }

      // 리프레시 토큰으로 자동 로그인 시에도 lastLogin, lastActive 업데이트
      const now = new Date();
      await db.update(users).set({ lastLogin: now, lastActive: now }).where(eq(users.id, user.id));

      const tokenPayload = {
        userId: user.id,
        username: user.username,
      };

      const newAccessToken = generateUserAccessToken(tokenPayload);
      const newRefreshToken = generateUserRefreshToken(tokenPayload);

      await createSession("user", user.id, {
        username: user.username,
      });

      // 모바일 앱용: JSON으로 토큰 반환 (쿠키 사용 안함)
      return res.json({
        success: true,
        message: "Access token과 refresh token이 재발급되었습니다.",
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error) {
      console.error("User refresh token error:", error);
      return res.status(401).json({ error: "유효하지 않거나 만료된 refresh token입니다." });
    }
  });

  // 현재 로그인한 사용자 정보 조회
  app.get("/api/users/me", userAuthMiddleware, async (req: any, res) => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: "인증되지 않은 사용자입니다." });
      }

      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      if (!user || user.length === 0) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }

      // 출석 기록 조회
      const attendanceRecords = await attendanceStorage.getUserAttendanceRecords(userId);

      // 비밀번호는 응답에서 제외
      const { password: _, ...userWithoutPassword } = user[0];

      return res.json({
        success: true,
        user: {
          ...userWithoutPassword,
          hasPassword: !!user[0].password,
        },
        attendanceRecords,
      });
    } catch (error) {
      console.error("Get current user error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 로그아웃 (모바일 앱용 - Bearer Token 방식)
  app.post("/api/users/logout", userAuthMiddleware, async (req: AuthenticatedUserRequest, res: Response) => {
    try {
      const userId = req.user?.userId;

      if (userId) {
        // lastLogout 업데이트
        await db.update(users).set({ lastLogout: new Date() }).where(eq(users.id, userId));
        
        // Redis 세션 삭제
        await deleteSession("user", userId);
      }

      // 모바일 앱용: 클라이언트에서 토큰 삭제 (쿠키 사용 안함)
      return res.json({
        success: true,
        message: "로그아웃되었습니다.",
      });
    } catch (error) {
      console.error("Logout error:", error);
      return res.json({
        success: true,
        message: "로그아웃되었습니다.",
      });
    }
  });

  // 초대 정보 조회 (내 초대 코드, 누적 초대 수)
  app.get("/api/users/invite-info", userAuthMiddleware, async (req: AuthenticatedUserRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }

      // 초대 코드가 없으면 생성 (기존 유저 대응)
      let inviteCode = user.inviteCode;
      if (!inviteCode) {
        inviteCode = await storage.generateInviteCodeForUser(userId);
      }

      const invitedCount = await storage.getInvitedCount(inviteCode);

      return res.json({
        inviteCode,
        invitedCount,
      });
    } catch (error) {
      console.error("Get invite info error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 유저 예측 내역 조회 (페이지네이션)
  app.get("/api/users/predictions", userAuthMiddleware, async (req: AuthenticatedUserRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 5;
      const offset = (page - 1) * limit;

      // predictions와 matches, stadiums를 join하여 조회
      const userPredictions = await db
        .select({
          id: predictions.id,
          prediction: predictions.prediction,
          amount: predictions.amount,
          status: predictions.status,
          wonAmount: predictions.wonAmount,
          createdAt: predictions.createdAt,
          matchId: matches.id,
          matchName: matches.name,
          matchDate: matches.matchDate,
          stadiumName: stadiums.name,
        })
        .from(predictions)
        .innerJoin(matches, eq(predictions.matchId, matches.id))
        .innerJoin(stadiums, eq(matches.stadiumId, stadiums.id))
        .where(eq(predictions.userId, userId))
        .orderBy(desc(predictions.createdAt))
        .limit(limit)
        .offset(offset);

      // 전체 예측 수 조회
      const totalResult = await db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(predictions)
        .where(eq(predictions.userId, userId));

      const total = totalResult[0]?.count || 0;

      // 승/패 통계 계산
      const stats = await db
        .select({
          status: predictions.status,
        })
        .from(predictions)
        .where(eq(predictions.userId, userId));

      const wins = stats.filter((s) => s.status === "success").length;
      const losses = stats.filter((s) => s.status === "fail").length;
      const pending = stats.filter((s) => s.status === "pending").length;

      // 현재 유저의 랭킹 계산 (승리 횟수 기준)
      let userRank: { rank: number; victories: number } | null = null;
      
      if (wins > 0) {
        // CTE를 사용하여 모든 유저의 승리 횟수와 랭킹을 계산
        const rankRows = await db.execute<{ rank: number; victory_count: number }>(sql`
          WITH ranked_users AS (
            SELECT 
              user_id,
              COUNT(*) as victory_count,
              DENSE_RANK() OVER (ORDER BY COUNT(*) DESC) as rank
            FROM ${predictions}
            WHERE status = 'success'
            GROUP BY user_id
          )
          SELECT rank::int as rank, victory_count::int as victory_count
          FROM ranked_users
          WHERE user_id = ${userId}
        `);

        // db.execute는 RowList(배열)을 반환
        if (rankRows.length > 0) {
          userRank = {
            rank: rankRows[0].rank,
            victories: rankRows[0].victory_count,
          };
        }
      }

      return res.json({
        success: true,
        predictions: userPredictions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        statistics: {
          total: stats.length,
          wins,
          losses,
          pending,
        },
        currentUserRank: userRank,
      });
    } catch (error) {
      console.error("Get user predictions error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 광고 시청 가능 여부 확인
  app.get("/api/users/ad-view/check/:adId", userAuthMiddleware, async (req: AuthenticatedUserRequest, res: Response) => {
    try {
      const adId = parseInt(req.params.adId);
      const userId = req.user!.userId;

      if (isNaN(adId)) {
        return res.status(400).json({ 
          error: "유효하지 않은 광고 ID입니다.",
          message: "유효하지 않은 광고 ID입니다."
        });
      }

      // 현재 유저 정보 조회
      const [user] = await db.select().from(users).where(eq(users.id, userId));

      if (!user) {
        return res.status(404).json({ 
          error: "사용자를 찾을 수 없습니다.",
          message: "사용자를 찾을 수 없습니다."
        });
      }

      // 1. 포인트 500 이상 확인
      if (user.points >= 500) {
        return res.json({
          canWatch: false,
          reason: "points_limit",
          message: "참여기록이 500 이상이면\n광고를 시청할 수 없습니다.",
        });
      }

      // 2. 시청 기록 확인
      const viewHistory = await db
        .select()
        .from(adViewHistory)
        .where(
          and(
            eq(adViewHistory.userId, userId),
            eq(adViewHistory.advertisementId, adId)
          )
        );

      if (viewHistory.length > 0) {
        return res.json({
          canWatch: false,
          reason: "already_watched",
          message: "이미 시청한 광고입니다.",
        });
      }

      // 시청 가능
      return res.json({
        canWatch: true,
        reason: null,
        message: null,
      });
    } catch (error) {
      console.error("Ad view check error:", error);
      return res.status(500).json({ 
        error: "서버 오류가 발생했습니다.",
        message: "서버 오류가 발생했습니다.\n잠시 후 다시 시도해주세요."
      });
    }
  });

  // 보상 영상 목록 조회 (시청 상태 포함)
  app.get("/api/users/video-rewards", userAuthMiddleware, async (req: AuthenticatedUserRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      // ID 1, 2만 가져오기 (소개 영상)
      const videoAds = await db
        .select()
        .from(advertisements)
        .where(sql`${advertisements.id} IN (1, 2)`)
        .orderBy(advertisements.id);

      // 해당 유저의 시청 기록 조회
      const viewHistory = await db
        .select()
        .from(adViewHistory)
        .where(eq(adViewHistory.userId, userId));

      const watchedAdIds = new Set(viewHistory.map(v => v.advertisementId));

      // 영상 3개 구성 (3번째는 아직 없음)
      const rewards = [
        {
          id: 1,
          order: 1,
          points: 500,
          title: videoAds.find(v => v.id === 1)?.videoName || "빠던 소개영상",
          videoUrl: videoAds.find(v => v.id === 1)?.videoUrl || null,
          isWatched: watchedAdIds.has(1),
        },
        {
          id: 2,
          order: 2,
          points: 1000,
          title: videoAds.find(v => v.id === 2)?.videoName || "게임소개영상 카페2",
          videoUrl: videoAds.find(v => v.id === 2)?.videoUrl || null,
          isWatched: watchedAdIds.has(2),
        },
        {
          id: 3,
          order: 3,
          points: 1500,
          title: "곧 공개 예정",
          videoUrl: null,
          isWatched: false,
          isLocked: true,
        },
      ];

      return res.json({ success: true, rewards });
    } catch (error) {
      console.error("Video rewards list error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 영상 시청 완료 처리 및 포인트 지급
  app.post("/api/users/video-rewards/:id/complete", userAuthMiddleware, async (req: AuthenticatedUserRequest, res: Response) => {
    try {
      const adId = parseInt(req.params.id);
      const userId = req.user!.userId;

      if (isNaN(adId) || ![1, 2, 3].includes(adId)) {
        return res.status(400).json({ error: "유효하지 않은 영상 ID입니다." });
      }

      // 3번 영상은 아직 준비 안됨
      if (adId === 3) {
        return res.status(400).json({ error: "아직 준비 중인 영상입니다." });
      }

      // 이미 시청했는지 확인
      const existingView = await db
        .select()
        .from(adViewHistory)
        .where(
          and(
            eq(adViewHistory.userId, userId),
            eq(adViewHistory.advertisementId, adId)
          )
        );

      if (existingView.length > 0) {
        return res.status(400).json({ error: "이미 시청한 영상입니다." });
      }

      // 포인트 결정
      const pointsMap: Record<number, number> = { 1: 500, 2: 1000, 3: 1500 };
      const earnedPoints = pointsMap[adId] || 0;

      // 현재 유저 정보 조회
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }

      // 시청 기록 추가
      await db.insert(adViewHistory).values({
        userId,
        advertisementId: adId,
      });

      // 포인트 트랜잭션 생성
      await db.insert(pointTransactions).values({
        userId,
        amount: earnedPoints,
        balance: user.points + earnedPoints,
        description: `영상 시청 보상 (${adId === 1 ? '빠던 소개영상' : '게임소개영상 카페2'})`,
        transactionType: "earned",
      });

      // 유저 포인트 업데이트
      await db
        .update(users)
        .set({ points: user.points + earnedPoints })
        .where(eq(users.id, userId));

      return res.json({ 
        success: true, 
        earnedPoints,
        message: `${earnedPoints}P가 지급되었습니다!`,
        newPoints: user.points + earnedPoints,
      });
    } catch (error) {
      console.error("Video reward complete error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}