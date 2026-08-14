import type { GameMatchItem } from "@/components/game/gameMatchUtils";

export interface SideBetRecord {
  id: number;
  type: "winner" | "score";
  winnerPick: "home" | "away" | null;
  homeScorePick: number | null;
  awayScorePick: number | null;
  amount: number;
  status: string;
  wonAmount: number;
}

export function formatSideBetStatus(status: string): string {
  switch (status) {
    case "won":
      return "적중";
    case "lost":
      return "미적중";
    case "refunded":
      return "환불";
    case "pending":
      return "대기";
    default:
      return status;
  }
}

/** 우승/점수 선택 요약 (pending은 상태 문구 생략) */
export function formatSideBetPickSummary(
  bet: SideBetRecord,
  homeName: string,
  awayName: string,
): string {
  const home = homeName.trim() || "홈팀";
  const away = awayName.trim() || "원정팀";
  const base =
    bet.type === "winner"
      ? bet.winnerPick === "home"
        ? home
        : bet.winnerPick === "away"
          ? away
          : "—"
      : `${away}(${bet.awayScorePick ?? 0}) : ${home}(${bet.homeScorePick ?? 0})`;

  if (bet.status === "pending") return base;
  const status = formatSideBetStatus(bet.status);
  if (bet.status === "won" && (bet.wonAmount ?? 0) > 0) {
    return `${base} · ${status} (+${bet.wonAmount}P)`;
  }
  return `${base} · ${status}`;
}

/** 경기 시작 시각 경과 또는 ongoing — 사이드벳 입력·자동 모달 차단 */
export function isMatchStartedForSideBets(
  match: Pick<GameMatchItem, "matchStatus" | "startTime">,
  nowMs = Date.now(),
): boolean {
  if (match.matchStatus === "ongoing") return true;
  if (!match.startTime) return false;
  const startMs = new Date(match.startTime).getTime();
  return Number.isFinite(startMs) && nowMs >= startMs;
}

/** 실황 연동 ON + 마감 전 + 경기 시작 전 + 종료·취소 아님 */
export function isSideBetActionEnabled(match: GameMatchItem, nowMs = Date.now()): boolean {
  if (!match.sideBetEnabled) return false;
  if (match.sideBetsLocked) return false;
  if (match.matchStatus === "completed" || match.matchStatus === "cancelled") return false;
  if (isMatchStartedForSideBets(match, nowMs)) return false;
  return true;
}

/** 경기 전·미입력 시에만 우승팀/점수 모달 자동 표시 */
export function shouldAutoOpenSideBetModal(
  match: GameMatchItem,
  hasSideBetPrediction: boolean,
  nowMs = Date.now(),
): boolean {
  if (hasSideBetPrediction) return false;
  return isSideBetActionEnabled(match, nowMs);
}

export function sideBetDisabledReason(match: GameMatchItem, nowMs = Date.now()): string | null {
  if (match.matchStatus === "completed" || match.matchStatus === "cancelled") {
    return null;
  }
  if (!match.sideBetEnabled) return "연동 대기";
  if (match.sideBetsLocked || isMatchStartedForSideBets(match, nowMs)) return "마감";
  return null;
}
