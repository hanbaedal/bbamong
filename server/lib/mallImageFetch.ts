import fs from "fs/promises";
import path from "path";

/** 마이그레이션·백필용 — 저장된 imageUrl에서 원본 바이트를 읽습니다. */
export async function fetchMallImageBytes(imageUrl: string): Promise<Buffer> {
  const trimmed = imageUrl.trim();
  if (!trimmed) {
    throw new Error("empty image URL");
  }

  if (trimmed.startsWith("/uploads/")) {
    const filePath = path.join(process.cwd(), "data", trimmed.slice(1));
    return fs.readFile(filePath);
  }

  const absolute =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `${(process.env.BASE_URL || "https://ppamong.com").replace(/\/+$/, "")}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;

  const res = await fetch(absolute, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`fetch failed (${res.status}): ${absolute}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
