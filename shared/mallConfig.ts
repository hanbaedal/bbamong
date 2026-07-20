/** 쇼핑몰 경로 prefix (ppamong.com/shop) */
export const MALL_BASE_PATH = "/shop";

/** 향후 shop.ppamong.com 서브도메인 */
export const MALL_SUBDOMAIN = "shop.ppamong.com";

export const MALL_SECTION_TITLE = "PPAMONG 스포츠몰";

export type MallSort = "popular" | "newest" | "price_asc" | "price_desc" | "discount";

export function isMallHost(hostname: string): boolean {
  return hostname === MALL_SUBDOMAIN || hostname.startsWith("shop.");
}

export function mallPath(subpath = ""): string {
  if (!subpath || subpath === "/") return MALL_BASE_PATH;
  const normalized = subpath.startsWith("/") ? subpath : `/${subpath}`;
  if (normalized.startsWith(MALL_BASE_PATH)) return normalized;
  return `${MALL_BASE_PATH}${normalized}`;
}
