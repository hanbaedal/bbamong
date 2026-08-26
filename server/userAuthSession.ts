import { randomUUID } from "crypto";
import {
  createSession,
  deleteSession,
  getSession,
  hasActiveSession,
  refreshSession,
} from "./sessionManager";
import { getSessionKey, SESSION_TTL } from "./sessionValidator";
import {
  generateUserAccessToken,
  generateUserRefreshToken,
  type UserTokenPayload,
} from "./utils/jwt";
import { getRedisClient } from "./redis";
import { wsManager } from "./liveMatch/wsManager";
import { interpretUserSession } from "@shared/userSessionVerdict";

export const SESSION_REPLACED_CODE = "SESSION_REPLACED";
export const SESSION_REPLACED_MESSAGE =
  "다른 기기에서 로그인하여 현재 세션이 종료되었습니다.";

/** 활성 세션이 있어 새 로그인을 거부할 때 */
export const SESSION_ACTIVE_CODE = "SESSION_ACTIVE";
export const SESSION_ACTIVE_MESSAGE =
  "이미 다른 기기에서 로그인되어 있습니다.\n본인이 아닌 경우 비밀번호를 변경해 주세요.";

const LOGIN_ATTEMPT_PREFIX = "login_attempt:user:";
const LOGIN_ATTEMPT_TTL_SEC = 10 * 60;

type UserIdentity = { id: string; username: string };

export type UserLoginGateResult =
  | { ok: true }
  | { ok: false; blocked: true };

/**
 * 활성 세션이 있으면 새 로그인을 막는다.
 * - force: 비밀번호 재확인 후 강제 로그인(기존 세션 교체)
 * - guest: 기기 로컬 guestId 기반이라 세션 교체 허용
 */
export async function gateUserLogin(
  userId: string,
  options: { force?: boolean; isGuest?: boolean } = {},
): Promise<UserLoginGateResult> {
  if (options.isGuest) {
    return { ok: true };
  }
  if (options.force) {
    return { ok: true };
  }

  const active = await hasActiveSession("user", userId);
  if (!active) {
    return { ok: true };
  }

  await recordBlockedLoginAttempt(userId);
  return { ok: false, blocked: true };
}

/** 차단된 로그인 시도를 활성 기기에 알림 (Redis + 경기 WS) */
export async function recordBlockedLoginAttempt(userId: string): Promise<void> {
  const at = new Date().toISOString();
  try {
    const redis = getRedisClient();
    await redis.setex(`${LOGIN_ATTEMPT_PREFIX}${userId}`, LOGIN_ATTEMPT_TTL_SEC, at);
  } catch (error) {
    console.error(`[Session] Failed to record login attempt for ${userId}:`, error);
  }

  try {
    wsManager.notifyUser(userId, "login_attempt", {
      at,
      message:
        "다른 곳에서 로그인을 시도했습니다. 본인이 아니면 비밀번호를 변경해 주세요.",
    });
  } catch (error) {
    console.error(`[Session] Failed to WS-notify login attempt for ${userId}:`, error);
  }
}

export async function peekLoginAttempt(userId: string): Promise<string | null> {
  try {
    const redis = getRedisClient();
    return await redis.get(`${LOGIN_ATTEMPT_PREFIX}${userId}`);
  } catch (error) {
    console.error(`[Session] Failed to peek login attempt for ${userId}:`, error);
    return null;
  }
}

export async function clearLoginAttempt(userId: string): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.del(`${LOGIN_ATTEMPT_PREFIX}${userId}`);
  } catch (error) {
    console.error(`[Session] Failed to clear login attempt for ${userId}:`, error);
  }
}

/** 로그인·가입 — 새 sessionId로 단일 세션 발급 (기존 기기 세션 교체) */
export async function issueUserAuthTokens(user: UserIdentity): Promise<{
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}> {
  const sessionId = randomUUID();
  await deleteSession("user", user.id);
  await createSession("user", user.id, {
    username: user.username,
    sessionId,
  });
  await clearLoginAttempt(user.id);
  const payload: UserTokenPayload = {
    userId: user.id,
    username: user.username,
    sessionId,
  };
  return {
    accessToken: generateUserAccessToken(payload),
    refreshToken: generateUserRefreshToken(payload),
    sessionId,
  };
}

/** refresh — 동일 sessionId 유지, TTL만 연장 */
export async function renewUserAuthTokens(
  user: UserIdentity,
  sessionId: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  await refreshSession("user", user.id);
  const payload: UserTokenPayload = {
    userId: user.id,
    username: user.username,
    sessionId,
  };
  return {
    accessToken: generateUserAccessToken(payload),
    refreshToken: generateUserRefreshToken(payload),
  };
}

export type UserSessionCheck = "ok" | "replaced" | "unavailable";

export type UserSessionClassify = UserSessionCheck | "missing" | "legacy";

export async function classifyUserSession(
  userId: string,
  jwtSessionId: string | undefined,
): Promise<UserSessionClassify> {
  try {
    const session = await getSession("user", userId);
    return interpretUserSession(session?.sessionId, jwtSessionId);
  } catch (error) {
    console.error(`[Session] classifyUserSession failed for user:${userId}:`, error);
    return "unavailable";
  }
}

/**
 * Redis에 세션이 없을 때만 JWT sessionId로 복구 (SET NX).
 * 재배포·redis-server 재시작 후 "다른 기기" 오탐을 막는다.
 * 이미 다른 sessionId가 있으면 replaced.
 */
export async function restoreUserSessionIfMissing(
  user: { id: string; username?: string },
  sessionId: string,
): Promise<"ok" | "replaced"> {
  const redis = getRedisClient();
  const key = getSessionKey("user", user.id);
  const data = JSON.stringify({
    userId: user.id,
    userType: "user",
    loginTime: new Date().toISOString(),
    username: user.username,
    sessionId,
    restoredFromJwt: true,
  });
  const created = await redis.set(key, data, "EX", SESSION_TTL, "NX");
  if (created === "OK") {
    console.log(`[Session] Restored missing Redis session for user:${user.id}`);
    return "ok";
  }
  const existing = await getSession("user", user.id);
  if (existing?.sessionId && existing.sessionId !== sessionId) {
    return "replaced";
  }
  if (existing?.sessionId === sessionId) return "ok";
  await redis.set(key, data, "EX", SESSION_TTL);
  console.log(`[Session] Filled Redis sessionId for user:${user.id}`);
  return "ok";
}

/**
 * JWT sessionId와 Redis 세션 일치 여부.
 * - replaced: Redis에 **다른** sessionId (실제 다른 기기)
 * - missing: Redis 없음 → JWT로 복구 후 ok
 * - legacy: JWT에 sessionId 없음 → 다른 기기로 취급하지 않음
 */
export async function assertUserSession(
  userId: string,
  sessionId: string | undefined,
  username?: string,
): Promise<UserSessionCheck> {
  const verdict = await classifyUserSession(userId, sessionId);
  if (verdict === "ok" || verdict === "unavailable") return verdict;
  if (verdict === "legacy") return "ok";
  if (verdict === "replaced") return "replaced";

  if (!sessionId) return "ok";
  try {
    return await restoreUserSessionIfMissing({ id: userId, username }, sessionId);
  } catch (error) {
    console.error(`[Session] restoreUserSession failed for user:${userId}:`, error);
    return "unavailable";
  }
}
