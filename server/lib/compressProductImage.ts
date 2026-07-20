import sharp from "sharp";
import { MALL_PRODUCT_IMAGE_MAX_BYTES } from "@shared/mallProduct";

export async function compressProductImage(
  input: Buffer,
  maxBytes = MALL_PRODUCT_IMAGE_MAX_BYTES,
): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
  let quality = 82;
  let width = 1280;

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
