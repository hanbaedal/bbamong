import fs from "fs/promises";
import path from "path";

function siteBaseUrl(): string {
  return (process.env.BASE_URL || "https://ppamong.com").replace(/\/+$/, "");
}

async function fetchFromSite(relativeOrAbsolute: string): Promise<Buffer> {
  const absolute =
    relativeOrAbsolute.startsWith("http://") || relativeOrAbsolute.startsWith("https://")
      ? relativeOrAbsolute
      : `${siteBaseUrl()}${relativeOrAbsolute.startsWith("/") ? relativeOrAbsolute : `/${relativeOrAbsolute}`}`;

  const res = await fetch(absolute, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`fetch failed (${res.status}): ${absolute}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** 마이그레이션·백필용 — 저장된 imageUrl에서 원본 바이트를 읽습니다. */
export async function fetchMallImageBytes(imageUrl: string): Promise<Buffer> {
  const trimmed = imageUrl.trim();
  if (!trimmed) {
    throw new Error("empty image URL");
  }

  if (trimmed.startsWith("/uploads/")) {
    const filePath = path.join(process.cwd(), "data", trimmed.slice(1));
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code !== "ENOENT") throw error;
      // Replit 디스크에 파일 없으면 운영 URL에서 다운로드
      return fetchFromSite(trimmed);
    }
  }

  return fetchFromSite(trimmed);
}

export function getR2BucketNameForLog(): string {
  return process.env.R2_BUCKET?.trim() || process.env.R2_BUCKET_NAME?.trim() || "";
}
