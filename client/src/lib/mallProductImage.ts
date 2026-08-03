import { resolveMallProductImageSrc } from "@/lib/mallProductImage";

interface ResolveMallImageInput {
  src?: string;
  thumbnailSrc?: string;
  variant?: "list" | "detail";
}

/** 목록 카드는 썸네일 URL 우선, 없으면 대표 이미지 */
export function resolveMallProductImageSrc({
  src,
  thumbnailSrc,
  variant = "detail",
}: ResolveMallImageInput): string {
  const primary = variant === "list" ? thumbnailSrc?.trim() || src?.trim() : src?.trim();
  return primary ?? "";
}
