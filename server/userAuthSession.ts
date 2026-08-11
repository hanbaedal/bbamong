import { randomUUID } from "crypto";
import {
  createSession,
  deleteSession,
  getSession,
  refreshSession,
} from "./sessionManager";
import {
  generateUserAccessToken,
  generateUserRefreshToken,
  type UserTokenPayload,
} from "./utils/jwt";

export const SESSION_REPLACED_CODE = "SESSION_REPLACED";
export const SESSION_REPLACED_MESSAGE =
  "다른 기기에서 로그인하여 현재 세션이 종료되었습니다.";

type UserIdentity = { id: string; username: string };

/** 로그인·가입 — 새 sessionId로 단일 세션 발급 (기존 기기 즉시 무효) */
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
