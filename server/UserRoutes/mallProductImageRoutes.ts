import type { Express } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { compressProductImage } from "../lib/compressProductImage";
import {
  isObjectStorageConfigured,
  saveMallProductImageLocal,
} from "../lib/mallProductImageStorage";
import { ObjectStorageService } from "../objectStorage";
import { MALL_PRODUCT_IMAGE_MAX_BYTES } from "@shared/mallProduct";

const uploadSchema = z.object({
  imageBase64: z.string().min(1).max(20_000_000),
});

function decodeBase64Image(payload: string): Buffer {
  const normalized = payload.includes(",") ? payload.split(",").pop()! : payload;
  return Buffer.from(normalized, "base64");
}

async function uploadToObjectStorage(
  buffer: Buffer,
  contentType: string,
  extension: string,
): Promise<string> {
  const objectStorage = new ObjectStorageService();
  return objectStorage.uploadPublicProductImage("mall-products", buffer, contentType, extension);
}

export async function mallProductImageRoutes(app: Express): Promise<void> {
  /** signed URL (Object Storage 설정 시) 또는 direct 모드 */
  app.post("/api/admin/mall/product-images/upload-url", adminAuthMiddleware, async (_req, res) => {
    try {
      if (!isObjectStorageConfigured()) {
        return res.json({
          mode: "direct" as const,
          maxBytes: MALL_PRODUCT_IMAGE_MAX_BYTES,
        });
      }

      const objectStorage = new ObjectStorageService();
      const { uploadURL, canonicalPath } = await objectStorage.getMallProductImageUploadURL();
      res.json({
        mode: "signed" as const,
        uploadURL,
        canonicalPath,
        maxBytes: MALL_PRODUCT_IMAGE_MAX_BYTES,
      });
    } catch (error) {
      console.error("Mall product image upload-url error:", error);
      res.json({
        mode: "direct" as const,
        maxBytes: MALL_PRODUCT_IMAGE_MAX_BYTES,
      });
    }
  });

  /** 서버 업로드 — GCS 우선, 실패·미설정 시 로컬 디스크 */
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
      let url: string;
      let storage: "gcs" | "local" = "local";

      if (isObjectStorageConfigured()) {
        try {
          url = await uploadToObjectStorage(
            compressed.buffer,
            compressed.contentType,
            compressed.extension,
          );
          storage = "gcs";
        } catch (gcsError) {
          console.warn("GCS upload failed, using local storage:", gcsError);
          url = await saveMallProductImageLocal(compressed.buffer, compressed.extension);
        }
      } else {
        url = await saveMallProductImageLocal(compressed.buffer, compressed.extension);
      }

      res.json({
        url,
        storage,
        sizeBytes: compressed.buffer.length,
        maxBytes: MALL_PRODUCT_IMAGE_MAX_BYTES,
      });
    } catch (error) {
      console.error("Mall product image upload error:", error);
      res.status(500).json({
        error:
          error instanceof Error && error.message.includes("sharp")
            ? "이미지 처리 모듈 오류입니다. 서버를 재시작해 주세요."
            : "이미지 업로드에 실패했습니다.",
      });
    }
  });
}
