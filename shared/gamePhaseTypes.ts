export type InningHalf = "top" | "bottom";

/** 팀 타순은 1~9 순환 (공수교대 후에도 이어서) */
export const BATTING_ORDER_SIZE = 9;

export function wrapBatterOrder(n: number | null | undefined): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 1;
  if (v < 1) return 1;
  return ((v - 1) % BATTING_ORDER_SIZE) + 1;
}

export function nextBatterOrder(n: number | null | undefined): number {
  return wrapBatterOrder(wrapBatterOrder(n) + 1);
}

export interface GamePhaseInfo {
  gameInning: number;
  inningHalf: InningHalf;
  batterIndexInHalf: number;
  battingSideLabel: string;
  displayLabel: string;
  currentRound?: number;
}

/** top=초(원정 공격), bottom=말(홈 공격) */
export function inningHalfShortLabel(half: InningHalf): "초" | "말" {
  return half === "top" ? "초" : "말";
}

export function formatInningWithHalf(gameInning: number, half: InningHalf): string {
  return `${gameInning}회 ${inningHalfShortLabel(half)}`;
}

export function battingSideLabel(half: InningHalf): string {
  return half === "top" ? "원정팀" : "홈팀";
}

export function parseInningHalf(value: string | null | undefined): InningHalf {
  return value === "bottom" ? "bottom" : "top";
}
