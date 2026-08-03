import type { ImgHTMLAttributes } from "react";
import { resolveMallProductImageSrc } from "@/lib/mallProductImage";

type MallProductImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string;
  thumbnailSrc?: string;
  variant?: "list" | "detail";
};

/** 쇼핑몰 상품 이미지 — 목록은 썸네일 우선, decoding/lazy 기본 적용 */
export default function MallProductImage({
  src,
  thumbnailSrc,
  variant = "detail",
  loading,
  decoding = "async",
  fetchPriority,
  alt = "",
  ...rest
}: MallProductImageProps) {
  const resolved = resolveMallProductImageSrc({ src, thumbnailSrc, variant });
  if (!resolved) return null;

  return (
    <img
      src={resolved}
      alt={alt}
      loading={loading ?? (variant === "list" ? "lazy" : undefined)}
      decoding={decoding}
      fetchPriority={fetchPriority}
      {...rest}
    />
  );
}
