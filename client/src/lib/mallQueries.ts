import { getFullUrl } from "@/lib/queryClient";
import type { MallCategory } from "@/lib/mallTypes";

export const MALL_CATEGORIES_QUERY_KEY = ["/api/mall/categories"] as const;

export async function fetchMallCategories(): Promise<{ categories: MallCategory[] }> {
  const res = await fetch(getFullUrl("/api/mall/categories"));
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export const MALL_RETURN_PATH_KEY = "ppamong:mall-return-path";

export function saveMallReturnPath(): void {
  try {
    sessionStorage.setItem(MALL_RETURN_PATH_KEY, window.location.pathname + window.location.search);
  } catch {
    /* ignore */
  }
}

export function readMallReturnPath(fallback: string): string {
  try {
    const stored = sessionStorage.getItem(MALL_RETURN_PATH_KEY);
    if (stored?.startsWith("/shop")) return stored;
  } catch {
    /* ignore */
  }
  return fallback;
}
