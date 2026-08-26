import {
  isGameFinished,
  isGameLiveStatus,
  isGameNotStarted,
  isGamePostponedOrCancelled,
  normalizeApiStatusShort,
} from "./apiSportsStatus";

/** 운영자 리스트 담당 경기 상태 (4단계) */
export type OperatorMatchPhase = "경기전" | "경기중" | "경기종료" | "연기됨";

/** 운영자 「경기종료」 연출 후 로그아웃 */
export const OPERATOR_MATCH_ENDED_LOGOUT_MS = 10_000;

/** 연출을 본 뒤 자격 만료 (finalizeMatchEnd setTimeout) */
export const OPERATOR_MATCH_ENDED_REVOKE_DELAY_MS = 12_000;

/** 경기종료 계정 비활성화는 연출 뒤 revoke에서만. 실황 FT 직후 sync하면 GET 403·refresh 401로 연출이 끊긴다. */
export function shouldDeferOperatorDeactivation(
  phase: OperatorMatchPhase | null,
): boolean {
  return phase === "경기종료";
}

/** 경기종료 인증 실패·연출 중에는 토큰을 지우지 않는다. */
export function shouldHoldOperatorSessionOnAuthError(input: {
  matchEnded: boolean;
  overlayStarted: boolean;
}): boolean {
  return input.matchEnded || input.overlayStarted;
}

/** 연출·만료·중복로그인·언마운트 중에는 WS를 다시 붙이지 않는다. */
export function shouldSkipOperatorWsReconnect(input: {
  overlayStarted: boolean;
  sessionExpired: boolean;
  duplicateLogin: boolean;
  unmounting: boolean;
}): boolean {
  return (
    input.overlayStarted ||
    input.sessionExpired ||
    input.duplicateLogin ||
    input.unmounting
  );
}

export function resolveOperatorMatchPhase(input: {
  matchStatus?: string | null;
  statusShort?: string | null;
  statusLong?: string | null;
}): OperatorMatchPhase | null {
  const short = normalizeApiStatusShort(input.statusShort);
  const matchStatus = input.matchStatus ?? undefined;

  if (isGamePostponedOrCancelled(short) || matchStatus === "cancelled") {
    return "연기됨";
  }
  if (isGameFinished(short) || matchStatus === "completed") {
    return "경기종료";
  }
  // API 시작 전이면 DB ongoing(예측 오픈 고착 등)보다 실황 우선 → 경기전
  if (isGameNotStarted(short)) {
    return "경기전";
  }
  if (isGameLiveStatus(short) || matchStatus === "ongoing") {
    return "경기중";
  }
  if (matchStatus === "scheduled" || !matchStatus) {
    return "경기전";
  }

  return "경기전";
}

/** 경기 상태 → 운영자 계정 활성화 여부 (경기전·경기중 = 활성화) */
export function operatorAccountStatusFromPhase(
  phase: OperatorMatchPhase | null,
): "활성화" | "비활성화" {
  if (phase === "경기전" || phase === "경기중") return "활성화";
  return "비활성화";
}

/** 담당 경기 상태 배지 (경기관리와 동일 톤) */
export function operatorMatchPhaseBadgeClass(phase: OperatorMatchPhase | null): string {
  switch (phase) {
    case "경기중":
      return "bg-green-50 text-green-700";
    case "경기종료":
      return "bg-gray-100 text-gray-600";
    case "연기됨":
      return "bg-purple-50 text-purple-700";
    case "경기전":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-gray-50 text-gray-500";
  }
}

export function operatorAccountStatusClass(status: string): string {
  return status === "활성화" ? "text-[#34A853] font-medium" : "text-[#BFBFBF]";
}
