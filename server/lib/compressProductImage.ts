import sharp from "sharp";
import {
  getMallProductImageLimits,
  type MallProductImageKind,
} from "@shared/mallProduct";

export async function compressProductImage(
  input: Buffer,
  kind: MallProductImageKind = "cover",
): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
  const { maxBytes, maxWidth: initialWidth } = getMallProductImageLimits(kind);
  let quality = kind === "detail" ? 85 : 82;
  let width = initialWidth;

  let lastBuffer = await sharp(input)
    .rotate()
    .resize({ width, fit: "inside", withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();

  while (lastBuffer.length > maxBytes && (quality > 15 || width > 240)) {
    if (quality > 20) {
      quality -= 8;
    } else {
      width = Math.max(240, Math.round(width * 0.82));
      quality = 72;
    }
    lastBuffer = await sharp(input)
      .rotate()
      .resize({ width, fit: "inside", withoutEnlargement: true })
      .webp({ quality: Math.max(12, quality) })
      .toBuffer();
  }

  return {
    buffer: lastBuffer,
    contentType: "image/webp",
    extension: ".webp",
  };
}
