import { Link } from "wouter";
import { Heart } from "lucide-react";
import { MALL_BASE_PATH } from "@shared/mallConfig";
import { discountRate, formatKrw } from "@/lib/mallCart";
import type { MallProduct } from "@/lib/mallTypes";

function resolvePrice(product: MallProduct): number {
  if (product.priceAmount && product.priceAmount > 0) return product.priceAmount;
  const digits = product.priceLabel.replace(/[^\d]/g, "");
  const parsed = parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

interface ProductCardProps {
  product: MallProduct;
}

export default function ProductCard({ product }: ProductCardProps) {
  const price = resolvePrice(product);
  const original = product.originalPriceAmount;
  const rate = discountRate(price, original);

  return (
    <Link
      href={`${MALL_BASE_PATH}/product/${product.id}`}
      className="group block"
    >
      <div className="aspect-[3/4] bg-neutral-100 rounded-sm overflow-hidden mb-3 relative">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-400 text-sm">
            이미지 없음
          </div>
        )}
        {rate !== null && rate > 0 && (
          <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-bold text-white bg-red-600">
            {rate}%
          </span>
        )}
        <button
          type="button"
          className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="찜"
          onClick={(e) => e.preventDefault()}
        >
          <Heart className="w-4 h-4 text-neutral-600" />
        </button>
      </div>
      {product.brand && (
        <p className="text-xs text-neutral-500 mb-0.5 truncate">{product.brand}</p>
      )}
      <p className="text-sm text-neutral-900 line-clamp-2 leading-snug mb-2 min-h-[2.5rem]">
        {product.name}
      </p>
      <div className="flex items-baseline gap-2 flex-wrap">
        {rate !== null && rate > 0 && (
          <span className="text-sm font-bold text-red-600">{rate}%</span>
        )}
        {price > 0 ? (
          <span className="text-sm font-bold text-neutral-900">{formatKrw(price)}</span>
        ) : (
          <span className="text-sm text-neutral-600">{product.priceLabel || "가격 문의"}</span>
        )}
        {original && original > price && (
          <span className="text-xs text-neutral-400 line-through">{formatKrw(original)}</span>
        )}
      </div>
    </Link>
  );
}

export { resolvePrice };
