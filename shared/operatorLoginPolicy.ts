/**
 * 빠몽 운영자 로그인 정책
 * ─────────────────────────────────────────────────────────────
 * • 계정: 관리자 > 운영자 리스트의 op1~op5 (빠몽에서만 정의·발급)
 * • 발급: 운영자 리스트에서 「비밀번호 생성」→ 아이디·비밀번호·로그인 링크
 * • 로그인: 카카오톡으로 링크 전송 → 운영자 앱 자동 로그인 (login-with-link)
 * • 빠던9 레거시 매니저: 별도 체계 — 빠몽 운영자 앱 로그인 불가
 */
export const PPAMONG_OPERATOR_USERNAMES = ["op1", "op2", "op3", "op4", "op5"] as const;

export type PpamongOperatorUsername = (typeof PPAMONG_OPERATOR_USERNAMES)[number];

export const PPAMONG_OPERATOR_LOGIN_DENIED =
  "빠몽 운영자 리스트(op1~op5)에서 발급된 계정만 로그인할 수 있습니다. 빠던9 운영자 계정은 사용할 수 없습니다.";

export const PPAMONG_OPERATOR_LINK_ONLY =
  "운영자 앱은 관리자가 발급한 카카오톡 로그인 링크로만 로그인할 수 있습니다.";

export function isPpamongOperatorUsername(username: string): boolean {
  return (PPAMONG_OPERATOR_USERNAMES as readonly string[]).includes(username);
}

/** 빠몽 운영자 앱 로그인·API 접근 허용 (op1~op5, userType=매니저) */
export function canAccessPpamongOperator(username: string, userType: string): boolean {
  return userType === "매니저" && isPpamongOperatorUsername(username);
}
