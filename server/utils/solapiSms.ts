import crypto from "crypto";
import https from "https";

const SOLAPI_HOST = "api.solapi.com";
const TIMEOUT_MS = 15000;

export function isSolapiConfigured(): boolean {
  return Boolean(process.env.SOLAPI_API_KEY?.trim() && process.env.SOLAPI_API_SECRET?.trim());
}

/** SOLAPI 설정 + PHONE_VERIFICATION_REQUIRED !== false 일 때만 SMS 인증 필수 */
export function isPhoneVerificationRequired(): boolean {
  const override = process.env.PHONE_VERIFICATION_REQUIRED?.trim().toLowerCase();
  if (override === "false" || override === "0" || override === "no") {
    return false;
  }
  if (override === "true" || override === "1" || override === "yes") {
    return isSolapiConfigured();
  }
  return isSolapiConfigured();
}

export function getSolapiSenderPhone(): string {
  return (process.env.SOLAPI_SENDER_PHONE || "01049961316").replace(/-/g, "");
}

function generateAuthHeader(): string {
  const apiKey = process.env.SOLAPI_API_KEY || "";
  const apiSecret = process.env.SOLAPI_API_SECRET || "";

  const date = new Date().toISOString();
  const salt = crypto.randomBytes(32).toString("hex");
  const signature = crypto.createHmac("sha256", apiSecret).update(date + salt).digest("hex");

  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

function httpsRequest({
  method,
  path,
  headers,
  body,
}: {
  method: string;
  path: string;
  headers: Record<string, string | number>;
  body?: string;
}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: SOLAPI_HOST, port: 443, method, path, headers, timeout: TIMEOUT_MS },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const json = JSON.parse(data || "{}");
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              return resolve(json);
            }
            reject({ statusCode: res.statusCode, body: json, raw: data });
          } catch {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              return resolve({ raw: data });
            }
            reject({ statusCode: res.statusCode, body: data });
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("REQUEST_TIMEOUT")));
    req.on("error", (error) => reject(error));
    if (body) req.write(body);
    req.end();
  });
}

export function formatSolapiError(error: unknown): string {
  if (error && typeof error === "object" && "body" in error) {
    const body = (error as { body?: unknown }).body;
    if (typeof body === "object" && body !== null) {
      const record = body as Record<string, unknown>;
      const message = record.errorMessage || record.message || record.error;
      if (typeof message === "string" && message.trim()) return message;
      return JSON.stringify(body);
    }
    if (typeof body === "string" && body.trim()) return body;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

/** @returns true if SMS was sent (or dev bypass logged) */
export async function sendSolapiSms({
  to,
  text,
  logLabel,
}: {
  to: string;
  text: string;
  logLabel: string;
}): Promise<{ sent: boolean; devMode: boolean }> {
  const cleanTo = to.replace(/-/g, "");
  const from = getSolapiSenderPhone();
  const message = { to: cleanTo, from, text, type: "SMS" as const };
  const body = Buffer.from(JSON.stringify({ message }), "utf8");

  if (!isSolapiConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SOLAPI_NOT_CONFIGURED");
    }
    console.log(`[개발모드][${logLabel}] SMS 미설정 — to=${cleanTo}, text=${text}`);
    return { sent: false, devMode: true };
  }

  const res = (await httpsRequest({
    method: "POST",
    path: "/messages/v4/send",
    headers: {
      Authorization: generateAuthHeader(),
      "Content-Type": "application/json",
      "Content-Length": body.length,
    },
    body: body.toString(),
  })) as { groupId?: string };

  if (!res.groupId) {
    throw new Error(`SMS_SEND_FAILED_${JSON.stringify(res)}`);
  }

  console.log(`[SMS][${logLabel}] sent to ${cleanTo} (from ${from})`);
  return { sent: true, devMode: false };
}
