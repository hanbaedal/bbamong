export type PredictionResult = "아웃" | "1루" | "2루" | "3루" | "홈런";

export const PREDICTION_ODDS: Record<PredictionResult, number> = {
  아웃: 1.2,
  "1루": 1.5,
  "2루": 3,
  "3루": 10,
  홈런: 5,
};

export const BET_AMOUNT_OPTIONS = [50, 100, 200, 500, 1000] as const;
export type BetAmountOption = (typeof BET_AMOUNT_OPTIONS)[number];

export const DEFAULT_BET_AMOUNT: BetAmountOption = 100;
export const AD_REWARD_POINTS = 500;
/** 전면/오버레이 광고: 이 시간 이후 사용자가 X로 끌 수 있음 (보상 없음) */
export const AD_EARLY_DISMISS_SECONDS = 5;
/** @deprecated 자동 완료 보상은 사용하지 않음 — 운영자 광고 중지 시에만 500P */
export const AD_OVERLAY_COMPLETE_SECONDS = 15;

export function isValidBetAmount(amount: number): amount is BetAmountOption {
  return (BET_AMOUNT_OPTIONS as readonly number[]).includes(amount);
}

export function getPredictionOdds(result: string): number {
  return PREDICTION_ODDS[result as PredictionResult] ?? 1;
}

export function calculateFixedOddsPayout(betAmount: number, result: string): number {
  const odds = getPredictionOdds(result);
  return Math.floor(betAmount * odds);
}

/** 경기 단위 사이드 배팅 (승리팀 / 최종 스코어) */
export type SideBetType = "winner" | "score";
export type WinnerSide = "home" | "away";

export const WINNER_ODDS = 2;
export const EXACT_SCORE_ODDS = 20;

export const SIDE_BET_AMOUNT_OPTIONS = [100, 200, 300, 500, 700, 1000] as const;
export type SideBetAmountOption = (typeof SIDE_BET_AMOUNT_OPTIONS)[number];
export const DEFAULT_SIDE_BET_AMOUNT: SideBetAmountOption = 100;

export function isValidSideBetAmount(amount: number): amount is SideBetAmountOption {
  return (SIDE_BET_AMOUNT_OPTIONS as readonly number[]).includes(amount);
}

export function getSideBetOdds(type: SideBetType): number {
  return type === "winner" ? WINNER_ODDS : EXACT_SCORE_ODDS;
}

export function calculateSideBetPayout(betAmount: number, type: SideBetType): number {
  return Math.floor(betAmount * getSideBetOdds(type));
}
