import type { Express, Request, Response } from "express";
import crypto from "crypto";
import https from "https";
import { getRedisClient } from "../redis";
import { userStorage } from "../UserStorage/userStorage";
import { AdminStorage } from "../storage/adminStorage";

const adminStorage = new AdminStorage();
const SOLAPI_HOST = "api.solapi.com";
const TIMEOUT_MS = 15000;
const CODE_EXPIRY_SECONDS = 180;

function generateAuthHeader(): string {
  const apiKey = process.env.SOLAPI_API_KEY || "";
  const apiSecret = process.env.SOLAPI_API_SECRET || "";
  
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(32).toString("hex");
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(date + salt)
    .digest("hex");
  
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

function httpsRequest({ method, path, headers, body }: { method: string; path: string; headers: Record<string, string | number>; body?: string }): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: SOLAPI_HOST, port: 443, method, path, headers, timeout: TIMEOUT_MS },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const json = JSON.parse(data || "{}");
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              return resolve(json);
            }
            reject({ statusCode: res.statusCode, body: json });
          } catch (e) {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              return resolve({ raw: data });
            }
            reject({ statusCode: res.statusCode, body: data });
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("REQUEST_TIMEOUT")));
    req.on("error", (e) => reject(e));
    if (body) req.write(body);
    req.end();
  });
}

async function sendSMS({ to, from, text }: { to: string; from: string; text: string }): Promise<any> {
  const message = { to, from, text };
  const body = Buffer.from(JSON.stringify({ message }), "utf8");
  
  const res = await httpsRequest({
    method: "POST",
    path: "/messages/v4/send",
    headers: {
      Authorization: generateAuthHeader(),
      "Content-Type": "application/json",
      "Content-Length": body.length,
    },
    body: body.toString(),
  });
  
  if (!res.groupId) {
    throw new Error(`SMS_SEND_FAILED_${JSON.stringify(res)}`);
  }
  
  return res;
}

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getPhoneVerificationKey(phone: string): string {
  return `phone_verification:${phone}`;
}

export async function phoneVerificationRoutes(app: Express): Promise<void> {
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
      
      // 전화번호 중복 체크 (회원가입용 - type에 따라 다른 테이블 체크)
      const accountType = req.body.type || "user";
      const excludeUserId = req.body.excludeUserId;
      
      if (accountType === "admin" || accountType === "manager") {
        const existingAdmin = await adminStorage.getAdminUserByPhone(cleanPhone, true);
        if (existingAdmin) {
          return res.status(400).json({ error: "이미 사용 중인 전화번호입니다." });
        }
      } else {
        const existingUser = await userStorage.getUserByPhone(cleanPhone);
        if (existingUser && existingUser.id !== excludeUserId) {
          return res.status(400).json({ error: "이미 사용 중인 전화번호입니다." });
        }
      }
      
      const code = generateVerificationCode();
      const redis = getRedisClient();
      const redisKey = getPhoneVerificationKey(cleanPhone);
      
      await redis.setex(redisKey, CODE_EXPIRY_SECONDS, code);
      
      const senderPhone = process.env.SOLAPI_SENDER_PHONE || "01049961316";
      
      try {
        await sendSMS({
          to: cleanPhone,
          from: senderPhone,
          text: `[인증번호] ${code}\n본인확인을 위해 인증번호를 입력해 주세요. (유효시간 3분)`,
        });
        
        console.log(`[SMS] 인증번호 ${code}가 ${cleanPhone}로 전송되었습니다.`);
        
        return res.json({
          success: true,
          message: "인증번호가 전송되었습니다.",
          expiresIn: CODE_EXPIRY_SECONDS,
        });
      } catch (smsError: any) {
        console.error("SMS 전송 실패:", smsError);
        
        if (!process.env.SOLAPI_API_KEY || !process.env.SOLAPI_API_SECRET) {
          console.log(`[개발모드] 인증번호: ${code} (전화번호: ${cleanPhone})`);
          return res.json({
            success: true,
            message: "인증번호가 전송되었습니다.",
            expiresIn: CODE_EXPIRY_SECONDS,
            devCode: process.env.NODE_ENV === "development" ? code : undefined,
          });
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
