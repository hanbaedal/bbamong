import {
  isGameFinished,
  isGameLiveStatus,
  isGameNotStarted,
  isGamePostponedOrCancelled,
  normalizeApiStatusShort,
} from "./apiSportsStatus";

/** 운영자 리스트 담당 경기 상태 (4단계) */
export type OperatorMatchPhase = "경기전" | "경기중" | "경기종료" | "연기됨";

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
