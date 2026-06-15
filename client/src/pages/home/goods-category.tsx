import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { getFullUrl } from "@/lib/queryClient";

interface GoodsCategory {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
}

interface GoodsProduct {
  id: number;
  name: string;
  summary: string;
  imageUrl: string;
  priceLabel: string;
}

export default function GoodsCategoryPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/home/goods/:categoryId");
  const categoryId = parseInt(params?.categoryId ?? "", 10);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/homepage/goods/categories", categoryId, "products"],
    queryFn: async () => {
      const res = await fetch(
        getFullUrl(`/api/homepage/goods/categories/${categoryId}/products`),
      );
      if (!res.ok) throw new Error("load failed");
      return res.json() as Promise<{ category: GoodsCategory; products: GoodsProduct[] }>;
    },
    enabled: !isNaN(categoryId),
  });

  const category = data?.category;
  const products = data?.products ?? [];

  return (
    <div className="h-app-screen bg-[#111111] flex flex-col">
      <PageHeader
        title={category?.name ?? "굿즈"}
        showSettings={false}
        leftAction={
          <button type="button" onClick={() => setLocation("/home")} className="p-1">
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        }
      />

      <div className="flex-1 overflow-y-scroll-touch px-5 pb-bottom-nav pt-2">
        {category?.description && (
          <p className="text-[#888] text-sm mb-4">{category.description}</p>
        )}

        {isLoading ? (
          <p className="text-[#888] text-sm">불러오는 중...</p>
        ) : products.length === 0 ? (
          <p className="text-[#888] text-sm text-center py-12">등록된 상품이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => setLocation(`/home/goods/item/${product.id}`)}
                className="text-left bg-[#1A1A1A] rounded-lg overflow-hidden border border-[#333]"
              >
                <div className="aspect-square bg-[#252525]">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#666] text-xs">
                      이미지 없음
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-white text-sm font-medium line-clamp-2">{product.name}</p>
                  {product.priceLabel && (
                    <p className="text-[#CDFF00] text-xs mt-1">{product.priceLabel}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
}
