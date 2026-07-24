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
export const AD_EARLY_DISMISS_SECONDS = 5;

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
