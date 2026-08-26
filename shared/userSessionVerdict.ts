/** JWT sessionId vs Redis stored sessionId — Redis 장애/재시작과 다른 기기 로그인을 구분한다. */

export type UserSessionVerdict = "ok" | "replaced" | "missing" | "legacy";

export function interpretUserSession(
  storedSessionId: string | null | undefined,
  jwtSessionId: string | undefined,
): UserSessionVerdict {
  if (!jwtSessionId) return "legacy";
  if (!storedSessionId) return "missing";
  if (storedSessionId === jwtSessionId) return "ok";
  return "replaced";
}
