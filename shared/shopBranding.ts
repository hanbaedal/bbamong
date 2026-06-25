export const SHOP_SECTION_TITLE = "빠몽이의 보물창고";

const LEGACY_SHOP_TITLES = new Set(["홈페이지", "PPAMONG 굿즈", "PPAMONG굿즈", "굿즈"]);

export function resolveShopSectionTitle(title?: string | null): string {
  const trimmed = title?.trim();
  if (!trimmed || LEGACY_SHOP_TITLES.has(trimmed)) {
    return SHOP_SECTION_TITLE;
  }
  return trimmed;
}
