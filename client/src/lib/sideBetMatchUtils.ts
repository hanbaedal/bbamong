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

/** API 폴링 ON + 마감 전 + 종료·취소 아님 */
export function isSideBetActionEnabled(match: GameMatchItem): boolean {
  if (!match.sideBetEnabled) return false;
  if (match.sideBetsLocked) return false;
  if (match.matchStatus === "completed" || match.matchStatus === "cancelled") return false;
  return true;
}

export function sideBetDisabledReason(match: GameMatchItem): string | null {
  if (match.matchStatus === "completed" || match.matchStatus === "cancelled") {
    return null;
  }
  if (!match.sideBetEnabled) return "연동 대기";
  if (match.sideBetsLocked) return "마감";
  return null;
}
