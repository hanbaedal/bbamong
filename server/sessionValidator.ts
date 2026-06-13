import { getRedisClient } from "./redis";

export type UserType = "user" | "manager" | "admin";

// 세션 TTL (7일)
export const SESSION_TTL = 60 * 60 * 24 * 7;

/**
 * 세션 키 생성 - 모든 세션 관련 코드에서 이 함수를 사용해야 함
 */
export function getSessionKey(userType: UserType, userId: string): string {
  return `session:${userType}:${userId}`;
}

export async function hasActiveSession(
  userType: UserType,
  userId: string
): Promise<boolean> {
  const redis = getRedisClient();
  const key = getSessionKey(userType, userId);
  const exists = await redis.exists(key);
  return exists === 1;
}
