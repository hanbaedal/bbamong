import { randomUUID } from "crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const UPLOAD_PREFIX = "mall-products";

function trimEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function normalizePublicBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

function normalizeExtension(extension: string): string {
  return extension.startsWith(".") ? extension : `.${extension}`;
}

/** R2 Secrets 5개가 모두 있을 때만 true */
export function isR2Configured(): boolean {
  return Boolean(
    trimEnv("R2_ACCOUNT_ID") &&
      trimEnv("R2_ACCESS_KEY_ID") &&
      trimEnv("R2_SECRET_ACCESS_KEY") &&
      trimEnv("R2_BUCKET") &&
      trimEnv("R2_PUBLIC_BASE_URL"),
  );
}

let cachedClient: S3Client | null = null;

function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;

  const accountId = trimEnv("R2_ACCOUNT_ID");
  if (!accountId) {
    throw new Error("R2_ACCOUNT_ID is not configured");
  }

  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: trimEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: trimEnv("R2_SECRET_ACCESS_KEY"),
    },
  });

  return cachedClient;
}

/**
 * 몰 상품 이미지를 Cloudflare R2에 업로드하고 공개 CDN URL을 반환합니다.
 * 경로: mall-products/{uuid}.webp
 */
export async function uploadMallProductImageToR2(
  buffer: Buffer,
  contentType: string,
  extension: string,
): Promise<string> {
  if (!isR2Configured()) {
    throw new Error("Cloudflare R2 is not configured");
  }

  const bucket = trimEnv("R2_BUCKET");
  const publicBase = normalizePublicBaseUrl(trimEnv("R2_PUBLIC_BASE_URL"));
  const fileName = `${randomUUID()}${normalizeExtension(extension)}`;
  const key = `${UPLOAD_PREFIX}/${fileName}`;

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000",
    }),
  );

  return `${publicBase}/${key}`;
}
