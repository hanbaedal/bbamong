import type { Express } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { compressProductImage } from "../lib/compressProductImage";
import { ObjectStorageService } from "../objectStorage";
import { MALL_PRODUCT_IMAGE_MAX_BYTES } from "@shared/mallProduct";

const uploadSchema = z.object({
  imageBase64: z.string().min(1).max(20_000_000),
});

function decodeBase64Image(payload: string): Buffer {
  const normalized = payload.includes(",") ? payload.split(",").pop()! : payload;
  return Buffer.from(normalized, "base64");
}

export async function mallProductImageRoutes(app: Express): Promise<void> {
  /** signed URL 방식 — Replit Object Storage와 동일 패턴 (권장) */
  app.post("/api/admin/mall/product-images/upload-url", adminAuthMiddleware, async (_req, res) => {
    try {
      const objectStorage = new ObjectStorageService();
      const { uploadURL, canonicalPath } = await objectStorage.getMallProductImageUploadURL();
      res.json({ uploadURL, canonicalPath, maxBytes: MALL_PRODUCT_IMAGE_MAX_BYTES });
    } catch (error) {
      console.error("Mall product image upload-url error:", error);
      const message =
        error instanceof Error && error.message.includes("PRIVATE_OBJECT_DIR")
          ? "Object Storage가 설정되지 않았습니다. Replit Object Storage 환경 변수를 확인해 주세요."
          : "업로드 URL 생성에 실패했습니다.";
      res.status(500).json({ error: message });
    }
  });

  /** 레거시 base64 업로드 (서버 압축) — fallback */
  app.post("/api/admin/mall/product-images", adminAuthMiddleware, async (req, res) => {
    try {
      const parsed = uploadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }

      const input = decodeBase64Image(parsed.data.imageBase64);
      if (input.length > 12 * 1024 * 1024) {
        return res.status(400).json({ error: "원본 이미지가 너무 큽니다. (최대 12MB)" });
      }

      const compressed = await compressProductImage(input, MALL_PRODUCT_IMAGE_MAX_BYTES);
      const objectStorage = new ObjectStorageService();
      const url = await objectStorage.uploadPublicProductImage(
        "mall-products",
        compressed.buffer,
        compressed.contentType,
        compressed.extension,
      );

      res.json({
        url,
        sizeBytes: compressed.buffer.length,
        maxBytes: MALL_PRODUCT_IMAGE_MAX_BYTES,
      });
    } catch (error) {
      console.error("Mall product image upload error:", error);
      const message =
        error instanceof Error && error.message.includes("PRIVATE_OBJECT_DIR")
          ? "Object Storage가 설정되지 않았습니다. Replit Object Storage 환경 변수를 확인해 주세요."
          : error instanceof Error && error.message.includes("sharp")
            ? "이미지 처리 모듈 오류입니다. 서버를 재시작해 주세요."
            : "이미지 업로드에 실패했습니다.";
      res.status(500).json({ error: message });
    }
  });
}
