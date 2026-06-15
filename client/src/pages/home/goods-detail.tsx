import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { getFullUrl } from "@/lib/queryClient";

interface GoodsProduct {
  id: number;
  categoryId: number;
  name: string;
  summary: string;
  detailContent: string;
  imageUrl: string;
  priceLabel: string;
  categoryName?: string;
}

export default function GoodsDetailPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/home/goods/item/:productId");
  const productId = parseInt(params?.productId ?? "", 10);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/homepage/goods/products", productId],
    queryFn: async () => {
      const res = await fetch(getFullUrl(`/api/homepage/goods/products/${productId}`));
      if (!res.ok) throw new Error("load failed");
      return res.json() as Promise<{ product: GoodsProduct }>;
    },
    enabled: !isNaN(productId),
  });

  const product = data?.product;

  return (
    <div className="h-app-screen bg-[#111111] flex flex-col">
      <PageHeader
        title="상품 상세"
        showSettings={false}
        leftAction={
          <button
            type="button"
            onClick={() =>
              product?.categoryId
                ? setLocation(`/home/goods/${product.categoryId}`)
                : setLocation("/home")
            }
            className="p-1"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        }
      />

      <div className="flex-1 overflow-y-scroll-touch px-5 pb-bottom-nav pt-2">
        {isLoading ? (
          <p className="text-[#888] text-sm">불러오는 중...</p>
        ) : !product ? (
          <p className="text-[#888] text-sm">상품을 찾을 수 없습니다.</p>
        ) : (
          <>
            <div className="aspect-square max-w-sm mx-auto rounded-lg overflow-hidden bg-[#252525] mb-4">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#666]">
                  이미지 없음
                </div>
              )}
            </div>
            {product.categoryName && (
              <p className="text-[#888] text-xs mb-1">{product.categoryName}</p>
            )}
            <h1 className="text-white text-lg font-bold mb-2">{product.name}</h1>
            {product.priceLabel && (
              <p className="text-[#CDFF00] text-base font-semibold mb-3">{product.priceLabel}</p>
            )}
            {product.summary && (
              <p className="text-[#BFBFBF] text-sm mb-4">{product.summary}</p>
            )}
            <div className="text-[#D5D5D5] text-sm leading-relaxed whitespace-pre-wrap border-t border-[#333] pt-4">
              {product.detailContent?.trim() || "상세 설명이 없습니다."}
            </div>
            <p className="text-[#666] text-xs mt-6 text-center">
              ※ 현재는 상품 안내만 제공됩니다. (결제 기능 없음)
            </p>
          </>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
}
