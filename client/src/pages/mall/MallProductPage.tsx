import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Heart, Minus, Plus } from "lucide-react";
import { MALL_BASE_PATH } from "@shared/mallConfig";
import { calculateMallRewardPoints, MALL_REWARD_RATE } from "@shared/mallRewards";
import { resolveAvailableStock, isProcureFulfillment, MALL_DEFAULT_PROCURE_NOTICE } from "@shared/mallProduct";
import MemberOnlyGate from "@/components/mall/MemberOnlyGate";
import MallProductDetailTabs from "@/components/mall/product/MallProductDetailTabs";
import { notifyMallCartChanged } from "@/components/mall/MallHeader";
import { resolvePrice } from "@/components/mall/ProductCard";
import { addToMallCart, discountRate, formatKrw } from "@/lib/mallCart";
import { fetchMemberSessionKind, type MemberSessionKind } from "@/lib/appNavigation";
import { getFullUrl } from "@/lib/queryClient";
import { useMallWishlist } from "@/hooks/useMallWishlist";
import { useToast } from "@/hooks/use-toast";
import type { MallProduct, MallProductDetailTab } from "@/lib/mallTypes";
import { cn } from "@/lib/utils";

export default function MallProductPage() {
  const { toast } = useToast();
  const { isWishlisted, toggle, toggling } = useMallWishlist();
  const [, params] = useRoute("/shop/product/:productId");
  const productId = parseInt(params?.productId ?? "", 10);
  const [quantity, setQuantity] = useState(1);
  const [sessionKind, setSessionKind] = useState<MemberSessionKind>("none");
  const [added, setAdded] = useState(false);
  const [activeTab, setActiveTab] = useState<MallProductDetailTab>("info");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [optionError, setOptionError] = useState("");

  useEffect(() => {
    void fetchMemberSessionKind().then(setSessionKind);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/homepage/goods/products", productId],
    queryFn: async () => {
      const res = await fetch(getFullUrl(`/api/homepage/goods/products/${productId}`));
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<{ product: MallProduct }>;
    },
    enabled: !isNaN(productId),
  });

  const product = data?.product;
  const isProcure = isProcureFulfillment(product?.fulfillmentType);
  const variants = useMemo(
    () =>
      !isProcure
        ? product?.variants?.filter((v) => v.color.trim() || v.size.trim()) ?? []
        : [],
    [product?.variants, isProcure],
  );
  const hasVariants = variants.length > 0;
  const colorOptions = useMemo(
    () => [...new Set(variants.map((v) => v.color.trim()).filter(Boolean))],
    [variants],
  );
  const sizeOptions = useMemo(() => {
    const pool = selectedColor
      ? variants.filter((v) => v.color.trim() === selectedColor)
      : variants;
    return [...new Set(pool.map((v) => v.size.trim()).filter(Boolean))];
  }, [variants, selectedColor]);

  const availableStock =
    product && !isProcure ? resolveAvailableStock(product, selectedColor, selectedSize) : null;
  const maxQuantity = isProcure
    ? 99
    : availableStock === null
      ? 99
      : availableStock > 0
        ? Math.min(99, availableStock)
        : 0;
  const isSoldOut = !isProcure && availableStock !== null && availableStock <= 0;
  const needsOptionSelection = !isProcure && hasVariants && (!selectedColor || !selectedSize);

  useEffect(() => {
    if (maxQuantity <= 0) return;
    setQuantity((q) => Math.min(q, maxQuantity));
  }, [maxQuantity]);

  const price = product ? resolvePrice(product) : 0;
  const rewardPoints = product?.rewardPoints ?? calculateMallRewardPoints(price);
  const rewardRatePercent = Math.round(MALL_REWARD_RATE * 100);
  const rate =
    product?.discountPercent && product.discountPercent > 0
      ? product.discountPercent
      : product
        ? discountRate(price, product.originalPriceAmount)
        : null;

  const handleAddToCart = () => {
    if (!product || price <= 0 || isSoldOut) return;
    if (needsOptionSelection) {
      setOptionError("컬러와 사이즈를 선택해 주세요.");
      return;
    }
    setOptionError("");
    addToMallCart(
      {
        productId: product.id,
        name: product.name,
        priceAmount: price,
        originalPriceAmount: product.originalPriceAmount,
        imageUrl: product.imageUrl,
        color: hasVariants ? selectedColor : undefined,
        size: hasVariants ? selectedSize : undefined,
      },
      quantity,
    );
    notifyMallCartChanged();
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const backPath = product?.categoryId
    ? `${MALL_BASE_PATH}/category/${product.categoryId}`
    : MALL_BASE_PATH;

  if (isLoading) {
    return <p className="p-8 text-center text-neutral-500">불러오는 중...</p>;
  }

  if (!product) {
    return <p className="p-8 text-center text-neutral-500">상품을 찾을 수 없습니다.</p>;
  }

  const checkoutQuery = new URLSearchParams({
    buy: String(product.id),
    qty: String(quantity),
  });
  if (hasVariants && selectedColor) checkoutQuery.set("color", selectedColor);
  if (hasVariants && selectedSize) checkoutQuery.set("size", selectedSize);
  const checkoutHref = `${MALL_BASE_PATH}/checkout?${checkoutQuery.toString()}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <Link
        href={backPath}
        className="inline-flex items-center gap-1 text-sm text-neutral-600 mb-6 hover:text-neutral-900"
      >
        <ChevronLeft className="w-4 h-4" />
        목록으로
      </Link>

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
        <div className="aspect-square bg-neutral-100 rounded-sm overflow-hidden">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-400">
              이미지 없음
            </div>
          )}
        </div>

        <div>
          {product.brand && <p className="text-sm text-neutral-500 mb-1">{product.brand}</p>}
          {product.categoryName && (
            <p className="text-xs text-neutral-400 mb-2">{product.categoryName}</p>
          )}
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="text-2xl font-bold text-neutral-900 flex-1">{product.name}</h1>
            <button
              type="button"
              disabled={toggling}
              className={cn(
                "shrink-0 rounded-full p-2 border border-neutral-200 transition-colors",
                isWishlisted(product.id)
                  ? "text-red-500 border-red-200 bg-red-50"
                  : "text-neutral-400 hover:text-red-500 hover:border-red-200",
              )}
              aria-label={isWishlisted(product.id) ? "찜 해제" : "찜"}
              onClick={async () => {
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
              }}
            >
              <Heart
                className="w-5 h-5"
                fill={isWishlisted(product.id) ? "currentColor" : "none"}
              />
            </button>
          </div>

          {isSoldOut && (
            <p className="mb-4 text-lg font-bold text-red-600 animate-pulse" role="status">
              판매완료
            </p>
          )}

          {isProcure && (
            <p className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 leading-relaxed">
              {product.procureNotice?.trim() || MALL_DEFAULT_PROCURE_NOTICE}
            </p>
          )}

          <div className="flex items-baseline gap-2 mb-6">
            {rate !== null && rate > 0 && (
              <span className="text-lg font-bold text-red-600">{rate}%</span>
            )}
            {price > 0 ? (
              <span className="text-2xl font-bold text-neutral-900">{formatKrw(price)}</span>
            ) : (
              <span className="text-lg text-neutral-600">{product.priceLabel || "가격 문의"}</span>
            )}
            {product.originalPriceAmount && product.originalPriceAmount > price && (
              <span className="text-sm text-neutral-400 line-through">
                {formatKrw(product.originalPriceAmount)}
              </span>
            )}
          </div>

          {rewardPoints > 0 && (
            <p className="text-sm text-emerald-700 mb-4 -mt-2">
              배송(택배 인계) 완료 후 결제 금액의 {rewardRatePercent}% →{" "}
              <span className="font-semibold">{rewardPoints.toLocaleString("ko-KR")}P</span> 게임 포인트 적립
            </p>
          )}

          {product.summary && (
            <p className="text-sm text-neutral-600 mb-4 leading-relaxed">{product.summary}</p>
          )}

          {(hasVariants || (!isProcure && (product.color || product.size)) || product.shippingLabel) && (
            <div className="space-y-4 mb-6">
              {hasVariants ? (
                <>
                  {colorOptions.length > 0 && (
                    <div>
                      <p className="text-sm text-neutral-600 mb-2">컬러</p>
                      <div className="flex flex-wrap gap-2">
                        {colorOptions.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => {
                              setSelectedColor(color);
                              setSelectedSize("");
                              setOptionError("");
                            }}
                            className={cn(
                              "px-3 py-1.5 text-sm border rounded-md",
                              selectedColor === color
                                ? "border-neutral-900 text-neutral-900 font-medium bg-neutral-50"
                                : "border-neutral-200 text-neutral-600 hover:border-neutral-400",
                            )}
                          >
                            {color}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {sizeOptions.length > 0 && (
                    <div>
                      <p className="text-sm text-neutral-600 mb-2">사이즈</p>
                      <div className="flex flex-wrap gap-2">
                        {sizeOptions.map((size) => {
                          const stock = resolveAvailableStock(product, selectedColor, size);
                          const disabled = stock !== null && stock <= 0;
                          return (
                            <button
                              key={size}
                              type="button"
                              disabled={disabled}
                              onClick={() => {
                                setSelectedSize(size);
                                setOptionError("");
                              }}
                              className={cn(
                                "px-3 py-1.5 text-sm border rounded-md",
                                selectedSize === size
                                  ? "border-neutral-900 text-neutral-900 font-medium bg-neutral-50"
                                  : "border-neutral-200 text-neutral-600 hover:border-neutral-400",
                                disabled && "opacity-40 cursor-not-allowed line-through",
                              )}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                !isProcure &&
                (product.color || product.size) && (
                  <dl className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-2 text-sm border border-neutral-100 rounded-md p-4 bg-neutral-50">
                    {product.color ? (
                      <>
                        <dt className="text-neutral-500">컬러</dt>
                        <dd className="text-neutral-900">{product.color}</dd>
                      </>
                    ) : null}
                    {product.size ? (
                      <>
                        <dt className="text-neutral-500">사이즈</dt>
                        <dd className="text-neutral-900">{product.size}</dd>
                      </>
                    ) : null}
                  </dl>
                )
              )}
              {isProcure && (product.color || product.size) && (
                <p className="text-sm text-neutral-600">
                  옵션:{" "}
                  <span className="text-neutral-900">
                    {[product.color, product.size].filter(Boolean).join(" / ")}
                  </span>
                </p>
              )}
              {product.shippingLabel && (
                <p className="text-sm text-neutral-600">
                  배송: <span className="text-neutral-900">{product.shippingLabel}</span>
                </p>
              )}
              {!isProcure && availableStock !== null && selectedColor && selectedSize && !isSoldOut && (
                <p className="text-sm text-neutral-600">
                  재고 <span className="font-medium text-neutral-900">{availableStock}개</span>
                </p>
              )}
              {!isProcure && !hasVariants && availableStock !== null && !isSoldOut && (
                <p className="text-sm text-neutral-600">
                  재고 <span className="font-medium text-neutral-900">{availableStock}개</span>
                </p>
              )}
            </div>
          )}

          {optionError && <p className="text-sm text-red-600 mb-4">{optionError}</p>}

          {price > 0 && !isSoldOut && maxQuantity > 0 && (
            <div className="flex items-center gap-3 mb-6">
              <span className="text-sm text-neutral-600">수량</span>
              <div className="flex items-center border border-neutral-200 rounded-md">
                <button
                  type="button"
                  className="p-2 hover:bg-neutral-50"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="수량 감소"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-10 text-center text-sm">{quantity}</span>
                <button
                  type="button"
                  className="p-2 hover:bg-neutral-50"
                  onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                  aria-label="수량 증가"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {price > 0 && isSoldOut && (
            <p className="text-sm font-medium text-red-600 mb-4">품절된 상품입니다.</p>
          )}

          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            {price > 0 && !isSoldOut && (
              <>
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={needsOptionSelection}
                  className="flex-1 h-12 text-sm font-semibold border border-neutral-900 text-neutral-900 rounded-md hover:bg-neutral-50 disabled:opacity-50"
                >
                  {added ? "장바구니에 담았습니다" : "장바구니 담기"}
                </button>
                {sessionKind === "member" ? (
                  <Link
                    href={needsOptionSelection ? "#" : checkoutHref}
                    onClick={(e) => {
                      if (needsOptionSelection) {
                        e.preventDefault();
                        setOptionError("컬러와 사이즈를 선택해 주세요.");
                      }
                    }}
                    className="flex-1 h-12 flex items-center justify-center text-sm font-semibold text-white bg-neutral-900 rounded-md hover:bg-neutral-800 disabled:opacity-50"
                  >
                    바로 구매
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="flex-1 h-12 text-sm font-semibold text-white bg-neutral-400 rounded-md cursor-not-allowed"
                    title="정회원만 주문 가능"
                  >
                    바로 구매 (회원 전용)
                  </button>
                )}
              </>
            )}
          </div>

          {sessionKind !== "member" && price > 0 && <MemberOnlyGate />}

          <div className="flex flex-wrap gap-2 mt-6">
            {(
              [
                ["info", "상품정보"],
                ["reviews", "리뷰"],
                ["recommend", "추천"],
                ["inquiry", "문의"],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  document.getElementById("product-detail-tabs")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-xs px-3 py-1.5 border border-neutral-200 rounded-full text-neutral-600 hover:border-neutral-900 hover:text-neutral-900"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div id="product-detail-tabs">
        <MallProductDetailTabs
          product={product}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>
    </div>
  );
}
