import { useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Minus, Plus } from "lucide-react";
import { MALL_BASE_PATH } from "@shared/mallConfig";
import MemberOnlyGate from "@/components/mall/MemberOnlyGate";
import { notifyMallCartChanged } from "@/components/mall/MallHeader";
import { resolvePrice } from "@/components/mall/ProductCard";
import { addToMallCart, discountRate, formatKrw } from "@/lib/mallCart";
import { fetchMemberSessionKind, type MemberSessionKind } from "@/lib/appNavigation";
import { getFullUrl } from "@/lib/queryClient";
import type { MallProduct } from "@/lib/mallTypes";
import { useEffect } from "react";

export default function MallProductPage() {
  const [, params] = useRoute("/shop/product/:productId");
  const productId = parseInt(params?.productId ?? "", 10);
  const [quantity, setQuantity] = useState(1);
  const [sessionKind, setSessionKind] = useState<MemberSessionKind>("none");
  const [added, setAdded] = useState(false);

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
  const price = product ? resolvePrice(product) : 0;
  const rate =
    product?.discountPercent && product.discountPercent > 0
      ? product.discountPercent
      : product
        ? discountRate(price, product.originalPriceAmount)
        : null;

  const handleAddToCart = () => {
    if (!product || price <= 0) return;
    addToMallCart(
      {
        productId: product.id,
        name: product.name,
        priceAmount: price,
        originalPriceAmount: product.originalPriceAmount,
        imageUrl: product.imageUrl,
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <Link href={backPath} className="inline-flex items-center gap-1 text-sm text-neutral-600 mb-6 hover:text-neutral-900">
        <ChevronLeft className="w-4 h-4" />
        목록으로
      </Link>

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
        <div className="aspect-square bg-neutral-100 rounded-sm overflow-hidden">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-400">이미지 없음</div>
          )}
        </div>

        <div>
          {product.brand && <p className="text-sm text-neutral-500 mb-1">{product.brand}</p>}
          {product.categoryName && (
            <p className="text-xs text-neutral-400 mb-2">{product.categoryName}</p>
          )}
          <h1 className="text-2xl font-bold text-neutral-900 mb-4">{product.name}</h1>

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

          {product.summary && (
            <p className="text-sm text-neutral-600 mb-4 leading-relaxed">{product.summary}</p>
          )}

          {(product.color || product.size || product.shippingLabel) && (
            <dl className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-2 text-sm mb-6 border border-neutral-100 rounded-md p-4 bg-neutral-50">
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
              {product.shippingLabel ? (
                <>
                  <dt className="text-neutral-500">배송</dt>
                  <dd className="text-neutral-900">{product.shippingLabel}</dd>
                </>
              ) : null}
            </dl>
          )}

          {price > 0 && (
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
                  onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                  aria-label="수량 증가"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 mb-8">
            {price > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="flex-1 h-12 text-sm font-semibold border border-neutral-900 text-neutral-900 rounded-md hover:bg-neutral-50"
                >
                  {added ? "장바구니에 담았습니다" : "장바구니 담기"}
                </button>
                {sessionKind === "member" ? (
                  <Link
                    href={`${MALL_BASE_PATH}/checkout?buy=${product.id}&qty=${quantity}`}
                    className="flex-1 h-12 flex items-center justify-center text-sm font-semibold text-white bg-neutral-900 rounded-md hover:bg-neutral-800"
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

          {sessionKind !== "member" && price > 0 && (
            <MemberOnlyGate />
          )}

          <div className="border-t border-neutral-200 pt-6 mt-6">
            <h2 className="text-sm font-semibold text-neutral-900 mb-3">상품 정보</h2>
            {product.detailImages && product.detailImages.length > 0 ? (
              <div className="space-y-3">
                {product.detailImages.map((url, index) => (
                  <img
                    key={`${url}-${index}`}
                    src={url}
                    alt={`${product.name} 상품정보 ${index + 1}`}
                    className="w-full rounded-sm border border-neutral-100"
                    loading="lazy"
                  />
                ))}
              </div>
            ) : (
              <div className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap">
                {product.detailContent?.trim() || product.summary?.trim() || "상세 설명이 없습니다."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
