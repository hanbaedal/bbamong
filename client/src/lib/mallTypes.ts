export interface MallProduct {
  id: number;
  categoryId: number;
  name: string;
  summary: string;
  detailContent: string;
  imageUrl: string;
  priceLabel: string;
  priceAmount?: number;
  originalPriceAmount?: number;
  brand?: string;
  categoryName?: string;
}

export interface MallCategory {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  productCount?: number;
}

export interface MallCartItem {
  productId: number;
  name: string;
  priceAmount: number;
  originalPriceAmount?: number;
  imageUrl: string;
  quantity: number;
}

export type MallSort = "popular" | "newest" | "price_asc" | "price_desc" | "discount";

export const MALL_SORT_OPTIONS: { value: MallSort; label: string }[] = [
  { value: "popular", label: "인기순" },
  { value: "newest", label: "신상품순" },
  { value: "price_asc", label: "낮은가격순" },
  { value: "price_desc", label: "높은가격순" },
  { value: "discount", label: "할인율순" },
];
