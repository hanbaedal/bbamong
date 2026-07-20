/** 상품 이미지 1장당 최대 용량 (20KB) */
export const MALL_PRODUCT_IMAGE_MAX_BYTES = 20 * 1024;

/** 상품정보 이미지 최대 개수 */
export const MALL_PRODUCT_DETAIL_IMAGE_MAX = 10;

export const MALL_DEFAULT_SHIPPING_LABEL = "무료배송";

/** 판매가격(정가) + 할인율 → 할인가격 */
export function calculateDiscountedPrice(originalPrice: number, discountPercent: number): number {
  if (!Number.isFinite(originalPrice) || originalPrice <= 0) return 0;
  const rate = Math.min(100, Math.max(0, discountPercent || 0));
  if (rate <= 0) return Math.round(originalPrice);
  return Math.round(originalPrice * (1 - rate / 100));
}

export function formatProductPriceLabel(amount: number): string {
  if (amount <= 0) return "가격 문의";
  return `${amount.toLocaleString("ko-KR")}원`;
}
