import { useQuery } from "@tanstack/react-query";
import { getFullUrl } from "@/lib/queryClient";
import ProductCard from "@/components/mall/ProductCard";
import type { MallProduct } from "@/lib/mallTypes";

interface MallProductRecommendPanelProps {
  productId: number;
  categoryName?: string;
}

export default function MallProductRecommendPanel({
  productId,
  categoryName,
}: MallProductRecommendPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/mall/products", productId, "related"],
    queryFn: async () => {
      const res = await fetch(getFullUrl(`/api/mall/products/${productId}/related?limit=8`));
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<{ products: MallProduct[] }>;
    },
  });

  const products = data?.products ?? [];

  if (isLoading) {
    return <p className="text-sm text-neutral-500 py-8 text-center">추천 상품을 불러오는 중...</p>;
  }

  if (products.length === 0) {
    return (
      <p className="text-sm text-neutral-500 py-8 text-center">
        {categoryName ? `${categoryName} 카테고리의` : ""} 다른 상품이 없습니다.
      </p>
    );
  }

  return (
    <div>
      <p className="text-sm text-neutral-600 mb-6">
        {categoryName ? `${categoryName} · ` : ""}함께 보면 좋은 상품
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
