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
  discountPercent?: number;
  brand?: string;
  color?: string;
  size?: string;
  stockQuantity?: number;
  variants?: MallProductVariant[];
  shippingLabel?: string;
  detailImages?: string[];
  categoryName?: string;
}

export interface MallProductVariant {
  color: string;
  size: string;
  stock: number;
}

export interface MallProductReview {
  id: number;
  productId: number;
  authorName: string;
  rating: number;
  content: string;
  isVisible: boolean;
  createdAt: string;
}

export interface MallProductReviewSummary {
  reviews: MallProductReview[];
  totalCount: number;
  averageRating: number;
}

export type MallProductDetailTab = "info" | "reviews" | "recommend" | "inquiry";

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
  color?: string;
  size?: string;
}

export type MallSort = "popular" | "newest" | "price_asc" | "price_desc" | "discount";

export const MALL_SORT_OPTIONS: { value: MallSort; label: string }[] = [
  { value: "popular", label: "인기순" },
  { value: "newest", label: "신상품순" },
  { value: "price_asc", label: "낮은가격순" },
  { value: "price_desc", label: "높은가격순" },
  { value: "discount", label: "할인율순" },
];
