import { useQuery } from "@tanstack/react-query";
import { getFullUrl } from "@/lib/queryClient";
import type { MallProduct, MallProductDetailTab } from "@/lib/mallTypes";
import MallProductInfoPanel from "./MallProductInfoPanel";
import MallProductReviewPanel from "./MallProductReviewPanel";
import MallProductRecommendPanel from "./MallProductRecommendPanel";
import MallProductInquiryPanel from "./MallProductInquiryPanel";

const TAB_ITEMS: { id: MallProductDetailTab; label: string }[] = [
  { id: "info", label: "상품정보" },
  { id: "reviews", label: "리뷰" },
  { id: "recommend", label: "추천" },
  { id: "inquiry", label: "문의" },
];

interface MallProductDetailTabsProps {
  product: MallProduct;
  activeTab: MallProductDetailTab;
  onTabChange: (tab: MallProductDetailTab) => void;
}

export default function MallProductDetailTabs({
  product,
  activeTab,
  onTabChange,
}: MallProductDetailTabsProps) {
  const { data: reviewSummary } = useQuery({
    queryKey: ["/api/mall/products", product.id, "reviews"],
    queryFn: async () => {
      const res = await fetch(getFullUrl(`/api/mall/products/${product.id}/reviews`));
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<{ totalCount: number }>;
    },
    staleTime: 60_000,
  });

  const reviewCount = reviewSummary?.totalCount ?? 0;

  return (
    <section className="mt-12 border-t border-neutral-900">
      <div
        className="sticky top-0 z-10 bg-white border-b border-neutral-200"
        role="tablist"
        aria-label="상품 상세 탭"
      >
        <div className="flex overflow-x-auto scrollbar-hide">
          {TAB_ITEMS.map((tab) => {
            const label =
              tab.id === "reviews" && reviewCount > 0 ? `${tab.label}(${reviewCount})` : tab.label;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange(tab.id)}
                className={`shrink-0 px-5 sm:px-8 py-4 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-neutral-900 text-neutral-900"
                    : "border-transparent text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="py-8" role="tabpanel">
        {activeTab === "info" && <MallProductInfoPanel product={product} />}
        {activeTab === "reviews" && <MallProductReviewPanel productId={product.id} />}
        {activeTab === "recommend" && (
          <MallProductRecommendPanel
            productId={product.id}
            categoryName={product.categoryName}
          />
        )}
        {activeTab === "inquiry" && (
          <MallProductInquiryPanel productId={product.id} productName={product.name} />
        )}
      </div>
    </section>
  );
}
