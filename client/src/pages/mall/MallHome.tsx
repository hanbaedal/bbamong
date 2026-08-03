import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import ProductCard from "@/components/mall/ProductCard";
import { getFullUrl } from "@/lib/queryClient";
import {
  findMallCategoryById,
  findMallCategoryParent,
  flattenMallCategories,
} from "@/lib/mallCategoryUtils";
import type { MallCategory, MallProduct, MallSort } from "@/lib/mallTypes";
import { MALL_SORT_OPTIONS } from "@/lib/mallTypes";
import { MALL_BASE_PATH } from "@shared/mallConfig";
import { cn } from "@/lib/utils";

interface MallHomeProps {
  categoryId?: number;
}

export default function MallHome({ categoryId }: MallHomeProps) {
  const searchString = useSearch();
  const params = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const sort = (params.get("sort") as MallSort) || "popular";
  const q = params.get("q") || "";
  const brand = params.get("brand") || "";
  const minPrice = params.get("minPrice") || "";
  const maxPrice = params.get("maxPrice") || "";

  const { data: categoriesData } = useQuery({
    queryKey: ["/api/mall/categories"],
    queryFn: async () => {
      const res = await fetch(getFullUrl("/api/mall/categories"));
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<{ categories: MallCategory[] }>;
    },
    staleTime: 60_000,
  });

  const categoryTree = categoriesData?.categories ?? [];
  const activeCategory = categoryId ? findMallCategoryById(categoryTree, categoryId) : undefined;
  const parentCategory =
    categoryId && activeCategory?.parentId != null
      ? findMallCategoryParent(categoryTree, categoryId)
      : activeCategory?.children?.length
        ? activeCategory
        : categoryId
          ? findMallCategoryParent(categoryTree, categoryId)
          : undefined;

  const subcategories = parentCategory?.children ?? [];

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["/api/mall/products", categoryId, sort, q, brand, minPrice, maxPrice],
    queryFn: async () => {
      const query = new URLSearchParams();
      query.set("sort", sort);
      if (categoryId) query.set("categoryId", String(categoryId));
      if (q) query.set("q", q);
      if (brand) query.set("brand", brand);
      if (minPrice) query.set("minPrice", minPrice);
      if (maxPrice) query.set("maxPrice", maxPrice);
      const res = await fetch(getFullUrl(`/api/mall/products?${query}`));
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<{ products: MallProduct[]; brands?: string[] }>;
    },
    staleTime: 30_000,
  });

  const products = productsData?.products ?? [];
  const brands = productsData?.brands ?? [];

  const listTitle = activeCategory
    ? activeCategory.name
    : q
      ? `"${q}" 검색 결과`
      : "추천 상품";

  const updateParams = (updates: Record<string, string | null>) => {
    const nextParams = new URLSearchParams(searchString);
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === "") nextParams.delete(key);
      else nextParams.set(key, value);
    }
    const base = categoryId ? `/shop/category/${categoryId}` : "/shop";
    window.history.replaceState(null, "", `${base}?${nextParams.toString()}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const setSort = (next: MallSort) => updateParams({ sort: next });

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-5">
      <div className="mb-4 lg:flex lg:items-start lg:gap-8">
        {/* 좌측 필터 (야구백화점형) */}
        <aside className="hidden lg:block w-48 shrink-0">
          <div className="sticky top-20 space-y-6">
            <div>
              <h2 className="text-sm font-bold text-neutral-900 mb-2">카테고리</h2>
              <ul className="space-y-1 text-sm">
                <li>
                  <Link href={MALL_BASE_PATH} className="text-neutral-600 hover:text-neutral-900">
                    전체
                  </Link>
                </li>
                {categoryTree.map((parent) => (
                  <li key={parent.id}>
                    <Link
                      href={`${MALL_BASE_PATH}/category/${parent.id}`}
                      className={cn(
                        "font-medium hover:text-neutral-900",
                        activeCategory?.id === parent.id ||
                          parent.children?.some((c) => c.id === categoryId)
                          ? "text-neutral-900"
                          : "text-neutral-600",
                      )}
                    >
                      {parent.name}
                    </Link>
                    {parent.children && parent.children.length > 0 && (
                      <ul className="mt-1 ml-2 space-y-0.5 border-l border-neutral-200 pl-2">
                        {parent.children.map((child) => (
                          <li key={child.id}>
                            <Link
                              href={`${MALL_BASE_PATH}/category/${child.id}`}
                              className={cn(
                                "text-xs hover:text-neutral-900",
                                categoryId === child.id ? "font-semibold text-neutral-900" : "text-neutral-500",
                              )}
                            >
                              {child.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {brands.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-neutral-900 mb-2">브랜드</h2>
                <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                  <li>
                    <button
                      type="button"
                      onClick={() => updateParams({ brand: null })}
                      className={cn(!brand ? "font-semibold text-neutral-900" : "text-neutral-600 hover:text-neutral-900")}
                    >
                      전체
                    </button>
                  </li>
                  {brands.map((b) => (
                    <li key={b}>
                      <button
                        type="button"
                        onClick={() => updateParams({ brand: b })}
                        className={cn(
                          brand === b ? "font-semibold text-neutral-900" : "text-neutral-600 hover:text-neutral-900",
                        )}
                      >
                        {b}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h2 className="text-sm font-bold text-neutral-900 mb-2">가격</h2>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  placeholder="최소"
                  value={minPrice}
                  onChange={(e) => updateParams({ minPrice: e.target.value || null })}
                  className="w-full h-8 rounded border border-neutral-200 px-2 text-xs"
                />
                <span className="text-neutral-400">~</span>
                <input
                  type="number"
                  placeholder="최대"
                  value={maxPrice}
                  onChange={(e) => updateParams({ maxPrice: e.target.value || null })}
                  className="w-full h-8 rounded border border-neutral-200 px-2 text-xs"
                />
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-4">
            <h1 className="text-lg font-bold tracking-tight text-neutral-900 sm:text-xl">{listTitle}</h1>
            {activeCategory?.description ? (
              <p className="mt-1 text-xs text-neutral-500 sm:text-sm">{activeCategory.description}</p>
            ) : !q ? (
              <p className="mt-1 text-xs text-neutral-500 sm:text-sm">야구용품을 카테고리·검색으로 찾아보세요</p>
            ) : null}
          </div>

          {subcategories.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              <Link
                href={`${MALL_BASE_PATH}/category/${parentCategory!.id}`}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  categoryId === parentCategory!.id
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 text-neutral-600 hover:border-neutral-400",
                )}
              >
                {parentCategory!.name} 전체
              </Link>
              {subcategories.map((sub) => (
                <Link
                  key={sub.id}
                  href={`${MALL_BASE_PATH}/category/${sub.id}`}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs",
                    categoryId === sub.id
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 text-neutral-600 hover:border-neutral-400",
                  )}
                >
                  {sub.name}
                </Link>
              ))}
            </div>
          )}

          <div className="mb-4 flex items-center justify-between gap-2 border-b border-neutral-200 pb-3">
            <p className="text-xs text-neutral-600 sm:text-sm">
              <span className="font-semibold text-neutral-900">{products.length}</span>개 상품
              {brand && <span className="text-neutral-400"> · {brand}</span>}
            </p>
            <select
              id="mall-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as MallSort)}
              className="h-8 rounded-lg border border-neutral-200 bg-white px-2 text-xs sm:text-sm"
              aria-label="정렬"
            >
              {MALL_SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl bg-[#f7f7f5] p-3">
                  <div className="mb-2.5 aspect-[4/5] rounded-xl bg-neutral-200" />
                  <div className="mb-2 h-4 rounded bg-neutral-200" />
                  <div className="h-3 w-2/3 rounded bg-neutral-200" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className="py-16 text-center text-sm text-neutral-500">등록된 상품이 없습니다.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { flattenMallCategories };
