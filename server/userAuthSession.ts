import { randomUUID } from "crypto";
import {
  createSession,
  deleteSession,
  getSession,
  hasActiveSession,
  refreshSession,
} from "./sessionManager";
import {
  generateUserAccessToken,
  generateUserRefreshToken,
  type UserTokenPayload,
} from "./utils/jwt";
import { getRedisClient } from "./redis";
import { wsManager } from "./liveMatch/wsManager";

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

/** JWT sessionId와 Redis 세션 일치 여부 */
export async function assertUserSession(
  userId: string,
  sessionId: string | undefined,
): Promise<UserSessionCheck> {
  if (!sessionId) return "replaced";
  try {
    const session = await getSession("user", userId);
    if (!session?.sessionId || session.sessionId !== sessionId) {
      return "replaced";
    }
    return "ok";
  } catch (error) {
    console.error(`[Session] assertUserSession failed for user:${userId}:`, error);
    return "unavailable";
  }
}
