/** 실황 자동 → 운영자·관리자 1탭/안내. 회원 예측 화면에는 보내지 않는다. */
export const LIVE_AUTO_OPERATOR_WS_TYPES = [
  "auto_result_suggested",
  "auto_action_suggested",
  "auto_action_blocked",
  "auto_result_timeout",
  "auto_pinch_suggested",
] as const;

export type LiveAutoOperatorWsType = (typeof LIVE_AUTO_OPERATOR_WS_TYPES)[number];

const OPERATOR_TYPE_SET = new Set<string>(LIVE_AUTO_OPERATOR_WS_TYPES);

export function isLiveAutoOperatorWsType(type: string): type is LiveAutoOperatorWsType {
  return OPERATOR_TYPE_SET.has(type);
}

export const LIVE_AUTO_STAFF_WS_ROLES = ["manager", "admin"] as const;
