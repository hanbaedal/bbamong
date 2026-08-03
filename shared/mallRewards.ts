/** 기념품 구매 확정(배송 인계) 시 게임 포인트 적립 — 결제 금액의 5% */
export const MALL_REWARD_RATE = 0.05;

export const MALL_REWARD_MIN_ORDER_AMOUNT = 0;

export function calculateMallRewardPoints(amount: number): number {
  if (!Number.isFinite(amount) || amount < MALL_REWARD_MIN_ORDER_AMOUNT) return 0;
  return Math.floor(amount * MALL_REWARD_RATE);
}

export function formatMallRewardPointsLabel(points: number): string {
  if (points <= 0) return "";
  return `최대 ${points.toLocaleString("ko-KR")}P 적립`;
}
