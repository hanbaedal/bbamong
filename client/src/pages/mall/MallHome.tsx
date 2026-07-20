import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import ProductCard from "@/components/mall/ProductCard";
import { getFullUrl } from "@/lib/queryClient";
import type { MallCategory, MallProduct, MallSort } from "@/lib/mallTypes";
import { MALL_SORT_OPTIONS } from "@/lib/mallTypes";

interface MallHomeProps {
  categoryId?: number;
}

export default function MallHome({ categoryId }: MallHomeProps) {
  const searchString = useSearch();
  const params = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const sort = (params.get("sort") as MallSort) || "popular";
  const q = params.get("q") || "";

  const { data: categoriesData } = useQuery({
    queryKey: ["/api/mall/categories"],
    queryFn: async () => {
      const res = await fetch(getFullUrl("/api/mall/categories"));
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<{ categories: MallCategory[] }>;
    },
    staleTime: 60_000,
  });

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["/api/mall/products", categoryId, sort, q],
    queryFn: async () => {
      const query = new URLSearchParams();
      query.set("sort", sort);
      if (categoryId) query.set("categoryId", String(categoryId));
      if (q) query.set("q", q);
      const res = await fetch(getFullUrl(`/api/mall/products?${query}`));
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<{ products: MallProduct[] }>;
    },
    staleTime: 30_000,
  });

  const categories = categoriesData?.categories ?? [];
  const products = productsData?.products ?? [];
  const activeCategory = categoryId
    ? categories.find((c) => c.id === categoryId)
    : undefined;

  const setSort = (next: MallSort) => {
    const nextParams = new URLSearchParams(searchString);
    nextParams.set("sort", next);
    const base = categoryId ? `/shop/category/${categoryId}` : "/shop";
    window.history.replaceState(null, "", `${base}?${nextParams.toString()}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
          {activeCategory ? activeCategory.name : q ? `"${q}" 검색 결과` : "스포츠"}
        </h1>
        {activeCategory?.description && (
          <p className="mt-1 text-sm text-neutral-500">{activeCategory.description}</p>
        )}
        {!activeCategory && !q && (
          <p className="mt-1 text-sm text-neutral-500">
            야구·스포츠 의류와 용품을 만나보세요
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 pb-4 border-b border-neutral-200">
        <p className="text-sm text-neutral-600">
          <span className="font-semibold text-neutral-900">{products.length}</span> Items
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="mall-sort" className="text-sm text-neutral-500 shrink-0">
            정렬
          </label>
          <select
            id="mall-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as MallSort)}
            className="h-9 px-3 text-sm border border-neutral-200 rounded-md bg-white"
          >
            {MALL_SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[3/4] bg-neutral-200 rounded-sm mb-3" />
              <div className="h-4 bg-neutral-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-neutral-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <p className="text-center text-neutral-500 py-16">등록된 상품이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 sm:gap-y-10">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
