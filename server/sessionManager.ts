import { getRedisClient } from "./redis";
import { wsManager } from "./liveMatch/wsManager";
import { 
  hasActiveSession, 
  getSessionKey, 
  SESSION_TTL,
  type UserType 
} from "./sessionValidator";

// Re-export for other modules
export { hasActiveSession, getSessionKey, SESSION_TTL, type UserType };

/**
 * 세션 생성
 */
export async function createSession(
  userType: UserType,
  userId: string,
  sessionData?: any
): Promise<void> {
  const redis = getRedisClient();
  const key = getSessionKey(userType, userId);
  
  const data = JSON.stringify({
    userId,
    userType,
    loginTime: new Date().toISOString(),
    ...sessionData,
  });

  await redis.setex(key, SESSION_TTL, data);
}

/**
 * 세션 삭제 및 WebSocket 연결 강제 종료
 */
export async function deleteSession(
  userType: UserType,
  userId: string
): Promise<void> {
  const redis = getRedisClient();
  const key = getSessionKey(userType, userId);
  await redis.del(key);
  
  // WebSocket 연결 강제 종료 (세션 삭제 시 기존 연결 정리)
  try {
    wsManager.forceDisconnectBySubjectId(userType, userId);
  } catch (error) {
    console.error(`[Session] Failed to force disconnect WebSocket for ${userType}:${userId}:`, error);
  }
}

/**
 * 세션 데이터 조회
 */
export async function getSession(
  userType: UserType,
  userId: string
): Promise<any | null> {
  const redis = getRedisClient();
  const key = getSessionKey(userType, userId);
  const data = await redis.get(key);
  
  if (!data) return null;
  
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * 세션 갱신 (TTL 연장)
 */
export async function refreshSession(
  userType: UserType,
  userId: string
): Promise<void> {
  const redis = getRedisClient();
  const key = getSessionKey(userType, userId);
  await redis.expire(key, SESSION_TTL);
}

/**
 * 세션에서 userId 추출
 */
export async function getUserIdFromSession(
  userType: UserType,
  userId: string
): Promise<string | null> {
  const session = await getSession(userType, userId);
  return session?.userId || null;
}

/**
 * 모든 세션 스캔 (userType별)
 */
export async function scanSessionsByType(userType: UserType): Promise<string[]> {
  const redis = getRedisClient();
  const userIds: string[] = [];
  let cursor = "0";
  
  do {
    const result = await redis.scan(cursor, "MATCH", `session:${userType}:*`, "COUNT", 100);
    cursor = result[0];
    const keys = result[1];
    
    for (const key of keys) {
      const userId = key.replace(`session:${userType}:`, "");
      userIds.push(userId);
    }
  } while (cursor !== "0");
  
  return userIds;
}

/**
 * 로그아웃 권한 부여 (BO에서 강제 로그아웃 시 사용)
 */
export async function grantLogoutPermission(
  userType: UserType,
  userId: string
): Promise<void> {
  const redis = getRedisClient();
  const key = `logout_allowed:${userType}:${userId}`;
  await redis.set(key, "1");
}

/**
 * 로그아웃 권한 확인
 */
export async function hasLogoutPermission(
  userType: UserType,
  userId: string
): Promise<boolean> {
  const redis = getRedisClient();
  const key = `logout_allowed:${userType}:${userId}`;
  const value = await redis.get(key);
  return value === "1";
}

/**
 * 로그아웃 권한 제거
 */
export async function revokeLogoutPermission(
  userType: UserType,
  userId: string
): Promise<void> {
  const redis = getRedisClient();
  const key = `logout_allowed:${userType}:${userId}`;
  await redis.del(key);
}

/**
 * 모든 세션 초기화 (서버 재시작 시 사용)
 * SCAN을 사용하여 블로킹 없이 안전하게 삭제
 */
export async function clearAllSessions(): Promise<void> {
  const redis = getRedisClient();
  let cursor = "0";
  const failedKeys: string[] = [];
  
  do {
    try {
      const result = await redis.scan(cursor, "MATCH", "session:*", "COUNT", 100);
      cursor = result[0];
      const keys = result[1];
      
      if (keys.length > 0) {
        try {
          await redis.del(...keys);
        } catch (delError) {
          console.error("Error deleting session keys, will retry:", delError);
          failedKeys.push(...keys);
        }
      }
    } catch (error) {
      console.error("Error during SCAN:", error);
      break;
    }
  } while (cursor !== "0");
  
  if (failedKeys.length > 0) {
    console.log(`Retrying ${failedKeys.length} failed keys...`);
    for (const key of failedKeys) {
      try {
        await redis.del(key);
      } catch (error) {
        console.error(`Failed to delete key ${key}:`, error);
      }
    }
  }
}
