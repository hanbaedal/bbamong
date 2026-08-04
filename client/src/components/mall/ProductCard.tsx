import { Link } from "wouter";
import { Heart, Star } from "lucide-react";
import { MALL_BASE_PATH } from "@shared/mallConfig";
import { calculateMallRewardPoints } from "@shared/mallRewards";
import { discountRate, formatKrw } from "@/lib/mallCart";
import { useMallWishlist } from "@/hooks/useMallWishlist";
import { useToast } from "@/hooks/use-toast";
import MallProductImage from "@/components/mall/MallProductImage";
import type { MallProduct, MallProductListItem } from "@/lib/mallTypes";
import { saveMallReturnPath } from "@/lib/mallQueries";
import { cn } from "@/lib/utils";

function resolvePrice(product: MallProduct | MallProductListItem): number {
  if (product.priceAmount && product.priceAmount > 0) return product.priceAmount;
  const digits = product.priceLabel.replace(/[^\d]/g, "");
  const parsed = parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCompactCount(n: number): string {
  return n.toLocaleString("ko-KR");
}

interface ProductCardProps {
  product: MallProduct | MallProductListItem;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { toast } = useToast();
  const { canWishlist, isWishlisted, toggle, toggling } = useMallWishlist();
  const price = resolvePrice(product);
  const original = product.originalPriceAmount;
  const rate = discountRate(price, original);
  const reviewCount = product.reviewCount ?? 0;
  const averageRating = product.averageRating ?? 0;
  const rewardPoints = product.rewardPoints ?? calculateMallRewardPoints(price);
  const shippingBadge = product.shippingLabel?.trim() || "무료배송";
  const wishlisted = isWishlisted(product.id);

  const handleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const result = await toggle(product.id);
    if (!result.ok) {
      toast({
        title: "로그인이 필요합니다",
        description: "찜은 게임 앱 정회원만 이용할 수 있습니다.",
      });
      return;
    }
    toast({
      description: result.wishlisted ? "찜 목록에 추가했습니다." : "찜 목록에서 제거했습니다.",
    });
  };

  return (
    <article className="group relative flex h-full flex-col rounded-2xl bg-[#f7f7f5] p-2.5 sm:p-3">
      <Link
        href={`${MALL_BASE_PATH}/product/${product.id}`}
        className="flex min-h-0 flex-1 flex-col"
        onClick={saveMallReturnPath}
      >
        <div className="relative mb-2.5 aspect-[4/5] overflow-hidden rounded-xl bg-white">
          {product.imageUrl || product.thumbnailUrl ? (
            <MallProductImage
              src={product.imageUrl}
              thumbnailSrc={product.thumbnailUrl}
              variant="list"
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">
              이미지 없음
            </div>
          )}
          {rate !== null && rate > 0 && (
            <span className="absolute left-2 top-2 rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {rate}%
            </span>
          )}
        </div>

        <h3 className="mb-1.5 line-clamp-2 min-h-[2.5rem] text-[13px] font-bold leading-snug text-neutral-900 sm:text-sm">
          {product.name}
        </h3>

        {reviewCount > 0 && (
          <div className="mb-1.5 flex items-center gap-1 text-[11px] text-neutral-500">
            <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
            <span>
              {averageRating.toFixed(1)} ({formatCompactCount(reviewCount)})
            </span>
          </div>
        )}

        <span className="mb-2 inline-flex w-fit rounded-md bg-neutral-200/80 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
          {shippingBadge}
        </span>

        <div className="mb-1 flex flex-wrap items-baseline gap-1.5">
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

        <div className="mt-auto pr-8 pt-0.5">
          {rewardPoints > 0 ? (
            <p className="text-[11px] text-neutral-500">
              배송 완료 시{" "}
              <span className="font-semibold text-neutral-700">
                {rewardPoints.toLocaleString("ko-KR")}P
              </span>{" "}
              적립
            </p>
          ) : (
            <span className="block h-[17px]" />
          )}
        </div>
      </Link>

      <button
        type="button"
        disabled={toggling}
        className={cn(
          "absolute bottom-2.5 right-2.5 shrink-0 rounded-full p-1 transition-colors sm:bottom-3 sm:right-3",
          wishlisted ? "text-red-500" : "text-neutral-400 hover:text-red-500",
          !canWishlist && "opacity-70",
        )}
        aria-label={wishlisted ? "찜 해제" : "찜"}
        aria-pressed={wishlisted}
        onClick={handleWishlist}
      >
        <Heart className="h-4 w-4" fill={wishlisted ? "currentColor" : "none"} strokeWidth={1.75} />
      </button>
    </article>
  );
}

export { resolvePrice };
