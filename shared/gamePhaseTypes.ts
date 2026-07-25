export type InningHalf = "top" | "bottom";

export interface GamePhaseInfo {
  gameInning: number;
  inningHalf: InningHalf;
  batterIndexInHalf: number;
  battingSideLabel: string;
  displayLabel: string;
  currentRound?: number;
}
