import type { Express } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { compressProductImage } from "../lib/compressProductImage";
import {
  isObjectStorageConfigured,
  saveMallProductImageLocal,
} from "../lib/mallProductImageStorage";
import { isR2Configured, uploadMallProductImageToR2 } from "../lib/r2MallImageStorage";
import { ObjectStorageService } from "../objectStorage";
import { getMallProductImageLimits } from "@shared/mallProduct";

const uploadSchema = z.object({
  imageBase64: z.string().min(1).max(20_000_000),
  kind: z.enum(["cover", "detail"]).optional().default("cover"),
});

const uploadUrlSchema = z.object({
  kind: z.enum(["cover", "detail"]).optional().default("cover"),
});

type MallImageStorage = "r2" | "gcs" | "local";

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

/** 우선순위: R2 → GCS → local */
async function persistMallProductImage(
  buffer: Buffer,
  contentType: string,
  extension: string,
): Promise<{ url: string; storage: MallImageStorage }> {
  if (isR2Configured()) {
    try {
      const url = await uploadMallProductImageToR2(buffer, contentType, extension);
      return { url, storage: "r2" };
    } catch (r2Error) {
      console.warn("R2 upload failed, trying GCS/local:", r2Error);
    }
  }

  if (isObjectStorageConfigured()) {
    try {
      const url = await uploadToObjectStorage(buffer, contentType, extension);
      return { url, storage: "gcs" };
    } catch (gcsError) {
      console.warn("GCS upload failed, using local storage:", gcsError);
    }
  }

  const url = await saveMallProductImageLocal(buffer, extension);
  return { url, storage: "local" };
}

export async function mallProductImageRoutes(app: Express): Promise<void> {
  app.post("/api/admin/mall/product-images/upload-url", adminAuthMiddleware, async (req, res) => {
    try {
      const parsed = uploadUrlSchema.safeParse(req.body ?? {});
      const kind = parsed.success ? parsed.data.kind : "cover";
      const { maxBytes } = getMallProductImageLimits(kind);

      // R2는 서버 업로드(direct)만 사용 — 브라우저→R2 CORS 설정 불필요
      if (isR2Configured() || !isObjectStorageConfigured()) {
        return res.json({ mode: "direct" as const, kind, maxBytes });
      }

      const objectStorage = new ObjectStorageService();
      const { uploadURL, canonicalPath } = await objectStorage.getMallProductImageUploadURL();
      res.json({
        mode: "signed" as const,
        kind,
        uploadURL,
        canonicalPath,
        maxBytes,
      });
    } catch (error) {
      console.error("Mall product image upload-url error:", error);
      const kind = "cover";
      res.json({
        mode: "direct" as const,
        kind,
        maxBytes: getMallProductImageLimits(kind).maxBytes,
      });
    }
  });

  app.post("/api/admin/mall/product-images", adminAuthMiddleware, async (req, res) => {
    try {
      const parsed = uploadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }

      const { kind } = parsed.data;
      const { maxBytes } = getMallProductImageLimits(kind);
      const input = decodeBase64Image(parsed.data.imageBase64);
      if (input.length > 12 * 1024 * 1024) {
        return res.status(400).json({ error: "원본 이미지가 너무 큽니다. (최대 12MB)" });
      }

      const compressed = await compressProductImage(input, kind);
      const { url, storage } = await persistMallProductImage(
        compressed.buffer,
        compressed.contentType,
        compressed.extension,
      );

      res.json({
        url,
        storage,
        kind,
        sizeBytes: compressed.buffer.length,
        maxBytes,
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
