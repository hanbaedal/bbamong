import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_SUBDIR = "mall-products";

export function isObjectStorageConfigured(): boolean {
  return Boolean(process.env.PRIVATE_OBJECT_DIR?.trim());
}

function getUploadsRoot(): string {
  return path.join(process.cwd(), "data", "uploads");
}

export function getMallProductUploadsDir(): string {
  return path.join(getUploadsRoot(), UPLOAD_SUBDIR);
}

/** Object Storage 미설정 시 로컬 디스크 저장 → /uploads/mall-products/... URL 반환 */
export async function saveMallProductImageLocal(
  buffer: Buffer,
  extension = ".webp",
): Promise<string> {
  const dir = getMallProductUploadsDir();
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${randomUUID()}${extension.startsWith(".") ? extension : `.${extension}`}`;
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, buffer);
  return `/uploads/${UPLOAD_SUBDIR}/${fileName}`;
}
