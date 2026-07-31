import { MALL_SECTION_TITLE } from "./mallConfig";

export const SHOP_SECTION_TITLE = MALL_SECTION_TITLE;

const LEGACY_SHOP_TITLES = new Set([
  "홈페이지",
  "PPAMONG 굿즈",
  "PPAMONG굿즈",
  "PPAMONG 스포츠몰",
  "PPAMONG 쇼핑몰",
  "굿즈",
  "빠몽이의 보물창고",
  "빠몽이 기념품 사러가기",
]);

export function resolveShopSectionTitle(title?: string | null): string {
  const trimmed = title?.trim();
  if (!trimmed || LEGACY_SHOP_TITLES.has(trimmed)) {
    return SHOP_SECTION_TITLE;
  }
  return trimmed;
}
