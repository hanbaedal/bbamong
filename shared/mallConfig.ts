/** 쇼핑몰 경로 prefix (ppamong.com/shop) */
export const MALL_BASE_PATH = "/shop";

/** 향후 shop.ppamong.com 서브도메인 */
export const MALL_SUBDOMAIN = "shop.ppamong.com";

export const MALL_SECTION_TITLE = "PPAMONG 스포츠몰";

/** 쇼핑몰 헤더·관리자 관리 화면 공통 카테고리 메뉴 */
export const MALL_DEFAULT_CATEGORIES = [
  { name: "팀의류", description: "팀 유니폼 · 저지", displayOrder: 1 },
  { name: "패션의류", description: "패션 의류", displayOrder: 2 },
  { name: "마킹키트", description: "마킹 · 네임텍", displayOrder: 3 },
  { name: "모자", description: "야구 모자 · 캡", displayOrder: 4 },
  { name: "야구용품", description: "글러브 · 배트 · 공", displayOrder: 5 },
  { name: "응원용품", description: "응원 도구", displayOrder: 6 },
  { name: "잡화", description: "기타 잡화", displayOrder: 7 },
  { name: "기획상품", description: "한정 기획", displayOrder: 8 },
  { name: "빠몽이 친구들", description: "캐릭터 굿즈", displayOrder: 9 },
  { name: "아울렛", description: "할인 · 아울렛", displayOrder: 10 },
] as const;

export const MALL_CATEGORY_NAMES = MALL_DEFAULT_CATEGORIES.map((c) => c.name);

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
