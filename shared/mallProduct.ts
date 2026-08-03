/** 대표(썸네일) 이미지 1장당 최대 용량 — 목록·상단용 (20KB) */
export const MALL_PRODUCT_IMAGE_MAX_BYTES = 20 * 1024;

/** 상품정보 탭 이미지 1장당 최대 용량 — 글·표 포함 세로 이미지 (80KB) */
export const MALL_PRODUCT_DETAIL_IMAGE_MAX_BYTES = 80 * 1024;

/** 목록 카드용 썸네일 1장당 최대 용량 (8KB) */
export const MALL_PRODUCT_THUMBNAIL_MAX_BYTES = 8 * 1024;

/** 대표 이미지 압축 시 최대 가로 */
export const MALL_PRODUCT_COVER_MAX_WIDTH = 1280;

/** 상품정보 이미지 압축 시 최대 가로 (스마트폰 전체 너비 기준) */
export const MALL_PRODUCT_DETAIL_MAX_WIDTH = 860;

/** 목록 카드용 썸네일 최대 가로 */
export const MALL_PRODUCT_THUMBNAIL_MAX_WIDTH = 400;

export type MallProductImageKind = "cover" | "detail" | "thumbnail";

export function getMallProductImageLimits(kind: MallProductImageKind = "cover") {
  if (kind === "detail") {
    return {
      maxBytes: MALL_PRODUCT_DETAIL_IMAGE_MAX_BYTES,
      maxWidth: MALL_PRODUCT_DETAIL_MAX_WIDTH,
    };
  }
  if (kind === "thumbnail") {
    return {
      maxBytes: MALL_PRODUCT_THUMBNAIL_MAX_BYTES,
      maxWidth: MALL_PRODUCT_THUMBNAIL_MAX_WIDTH,
    };
  }
  return {
    maxBytes: MALL_PRODUCT_IMAGE_MAX_BYTES,
    maxWidth: MALL_PRODUCT_COVER_MAX_WIDTH,
  };
}

/** 몰 상품 목록 API 응답 (카드 렌더링용 슬림 필드) */
export interface MallProductListItem {
  id: number;
  categoryId: number;
  name: string;
  imageUrl: string;
  thumbnailUrl?: string;
  priceLabel: string;
  priceAmount?: number;
  originalPriceAmount?: number;
  discountPercent?: number;
  brand?: string;
  shippingLabel?: string;
  reviewCount: number;
  averageRating: number;
  rewardPoints: number;
}

/** 상품정보 이미지 최대 개수 */
export const MALL_PRODUCT_DETAIL_IMAGE_MAX = 10;

/** 옵션(컬러·사이즈)별 재고 최대 행 수 */
export const MALL_PRODUCT_VARIANT_MAX = 30;

export const MALL_DEFAULT_SHIPPING_LABEL = "무료배송";

/** stock=창고 재고 판매, procure=주문 후 매입·발송 */
export type MallFulfillmentType = "stock" | "procure";

export const MALL_FULFILLMENT_OPTIONS: { value: MallFulfillmentType; label: string; description: string }[] = [
  {
    value: "stock",
    label: "재고판매",
    description: "창고 재고 기준. 품절 시 판매완료 표시, 주문 시 재고 차감",
  },
  {
    value: "procure",
    label: "주문후조달",
    description: "재고 미표시. 주문 접수 후 매입·입고·발송",
  },
];

export const MALL_DEFAULT_PROCURE_NOTICE = "주문 확인 후 매입·제작되어 발송됩니다. (보통 7~14일 소요)";

export function isProcureFulfillment(
  fulfillmentType?: MallFulfillmentType | string | null,
): boolean {
  return fulfillmentType === "procure";
}

export function shouldValidateStockOnOrder(product: {
  fulfillmentType?: MallFulfillmentType | string | null;
}): boolean {
  return !isProcureFulfillment(product.fulfillmentType);
}

export interface MallProductVariant {
  color: string;
  size: string;
  stock: number;
}

/** 옵션 목록에서 컬러·사이즈 일치 행 찾기 */
export function findProductVariant(
  variants: MallProductVariant[] | undefined,
  color: string,
  size: string,
): MallProductVariant | undefined {
  if (!variants?.length) return undefined;
  const c = color.trim();
  const s = size.trim();
  return variants.find((v) => v.color.trim() === c && v.size.trim() === s);
}

/** 선택 옵션 또는 단일 재고 기준 가용 수량. null = 재고 미설정(무제한) */
export function resolveAvailableStock(
  product: {
    variants?: MallProductVariant[];
    stockQuantity?: number;
  },
  color?: string,
  size?: string,
): number | null {
  const variants = product.variants?.filter((v) => v.color.trim() || v.size.trim()) ?? [];
  if (variants.length > 0) {
    if (!color?.trim() || !size?.trim()) return 0;
    const variant = findProductVariant(variants, color, size);
    if (!variant) return 0;
    return Math.max(0, variant.stock);
  }
  if (product.stockQuantity === undefined || product.stockQuantity === null || product.stockQuantity < 0) {
    return null;
  }
  return Math.max(0, product.stockQuantity);
}

export function summarizeVariantLabels(variants: MallProductVariant[]): { color: string; size: string } {
  const colors = [...new Set(variants.map((v) => v.color.trim()).filter(Boolean))];
  const sizes = [...new Set(variants.map((v) => v.size.trim()).filter(Boolean))];
  return {
    color: colors.join(", "),
    size: sizes.join(", "),
  };
}

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
