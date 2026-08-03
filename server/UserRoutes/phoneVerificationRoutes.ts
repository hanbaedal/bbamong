import type { Express, Request, Response } from "express";
import { getRedisClient } from "../redis";
import { userStorage } from "../UserStorage/userStorage";
import { AdminStorage } from "../storage/adminStorage";
import { formatSolapiError, getPhoneVerificationDelivery, sendSolapiSms } from "../utils/solapiSms";

const adminStorage = new AdminStorage();
const CODE_EXPIRY_SECONDS = 180;

const PHONE_ALREADY_REGISTERED =
  "이미 가입된 전화번호입니다. 로그인 또는 아이디·비밀번호 찾기를 이용해 주세요.";

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getPhoneVerificationKey(phone: string): string {
  return `phone_verification:${phone}`;
}

export async function phoneVerificationRoutes(app: Express): Promise<void> {
  app.get("/api/phone/verification-config", (_req: Request, res: Response) => {
    const delivery = getPhoneVerificationDelivery();
    res.json({
      required: delivery !== "none",
      delivery,
    });
  });

  app.post("/api/phone/send-code", async (req: Request, res: Response) => {
    try {
      const { phone } = req.body;

      if (!phone) {
        return res.status(400).json({ error: "전화번호를 입력해주세요." });
      }

      const cleanPhone = phone.replace(/-/g, "");

      if (!/^01[0-9]{8,9}$/.test(cleanPhone)) {
        return res.status(400).json({ error: "올바른 전화번호 형식이 아닙니다." });
      }

      const accountType = req.body.type || "user";
      const excludeUserId = req.body.excludeUserId;

      if (accountType === "admin" || accountType === "manager") {
        const existingAdmin = await adminStorage.getAdminUserByPhone(cleanPhone, true);
        if (existingAdmin) {
          return res.status(400).json({ error: PHONE_ALREADY_REGISTERED });
        }
      } else {
        const existingUser = await userStorage.getUserByPhone(cleanPhone);
        if (existingUser && existingUser.id !== excludeUserId) {
          return res.status(400).json({ error: PHONE_ALREADY_REGISTERED });
        }
      }

      const code = generateVerificationCode();
      const redis = getRedisClient();
      const redisKey = getPhoneVerificationKey(cleanPhone);

      await redis.setex(redisKey, CODE_EXPIRY_SECONDS, code);

      const respondInApp = (message: string) =>
        res.json({
          success: true,
          message,
          expiresIn: CODE_EXPIRY_SECONDS,
          displayCode: code,
          delivery: "in_app" as const,
        });

      try {
        const smsResult = await sendSolapiSms({
          to: cleanPhone,
          text: `[PPAMONG] 인증번호 ${code}\n본인확인을 위해 입력해 주세요. (3분 유효)`,
          logLabel: "회원가입",
        });

        if (smsResult.devMode) {
          console.log(`[인앱인증] 회원가입 인증번호: ${code} (전화번호: ${cleanPhone})`);
          return respondInApp("인증번호가 발급되었습니다. 아래 번호를 입력해 주세요.");
        }

        return res.json({
          success: true,
          message: "인증번호가 전송되었습니다.",
          expiresIn: CODE_EXPIRY_SECONDS,
          delivery: "sms" as const,
        });
      } catch (smsError) {
        console.error("SMS 전송 실패:", formatSolapiError(smsError), smsError);

        if (smsError instanceof Error && smsError.message === "SOLAPI_NOT_CONFIGURED") {
          console.log(`[인앱인증] 회원가입 인증번호: ${code} (전화번호: ${cleanPhone})`);
          return respondInApp("인증번호가 발급되었습니다. 화면에 표시된 번호를 입력해 주세요.");
        }

        await redis.del(redisKey);

        return res.status(500).json({ error: "SMS 전송에 실패했습니다. 잠시 후 다시 시도해주세요." });
      }
    } catch (error) {
      console.error("Send phone code error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.post("/api/phone/verify-code", async (req: Request, res: Response) => {
    try {
      const { phone, code } = req.body;

      if (!phone || !code) {
        return res.status(400).json({ error: "전화번호와 인증번호를 입력해주세요." });
      }

      const cleanPhone = phone.replace(/-/g, "");
      const redis = getRedisClient();
      const redisKey = getPhoneVerificationKey(cleanPhone);

      const storedCode = await redis.get(redisKey);

      if (!storedCode) {
        return res.status(400).json({ error: "인증번호가 만료되었거나 요청되지 않았습니다. 다시 요청해주세요." });
      }

      if (storedCode !== code) {
        return res.status(400).json({ error: "인증번호가 일치하지 않습니다." });
      }

      await redis.del(redisKey);

      const verifiedKey = `phone_verified:${cleanPhone}`;
      await redis.setex(verifiedKey, 1800, "true");

      return res.json({
        success: true,
        message: "전화번호 인증이 완료되었습니다.",
        verified: true,
      });
    } catch (error) {
      console.error("Verify phone code error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/phone/check-verified/:phone", async (req: Request, res: Response) => {
    try {
      const { phone } = req.params;
      const cleanPhone = phone.replace(/-/g, "");

      const redis = getRedisClient();
      const verifiedKey = `phone_verified:${cleanPhone}`;
      const isVerified = await redis.get(verifiedKey);

      return res.json({
        verified: isVerified === "true",
      });
    } catch (error) {
      console.error("Check phone verified error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}
