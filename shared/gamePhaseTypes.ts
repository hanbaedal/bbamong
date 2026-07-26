export type InningHalf = "top" | "bottom";

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
