/**
 * 쇼핑몰 상품 이미지 R2 마이그레이션 + 썸네일 백필
 *
 * 실행 (Replit Shell / 로컬, MONGODB_URI + R2 Secrets 필요):
 *   npx tsx scripts/migrate-mall-images-to-r2.ts
 *   npx tsx scripts/migrate-mall-images-to-r2.ts --dry-run
 *   npx tsx scripts/migrate-mall-images-to-r2.ts --thumbnails-only
 */
import { connectMongoDB, disconnectMongoDB } from "../server/UserStorage/db";
import { GoodsProductModel } from "../server/mongodb/models";
import { compressProductImage } from "../server/lib/compressProductImage";
import { fetchMallImageBytesValidated, getR2BucketNameForLog } from "../server/lib/mallImageFetch";
import {
  getR2PublicBaseUrl,
  isR2Configured,
  isR2PublicUrl,
  uploadMallProductImageToR2,
} from "../server/lib/r2MallImageStorage";

type ProductDoc = {
  id: number;
  name: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  detailImages?: string[];
};

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const thumbnailsOnly = args.has("--thumbnails-only");

async function uploadBuffer(buffer: Buffer, kind: "cover" | "detail" | "thumbnail"): Promise<string> {
  const compressed = await compressProductImage(buffer, kind);
  return uploadMallProductImageToR2(compressed.buffer, compressed.contentType, compressed.extension);
}

async function migrateDetailUrl(url: string): Promise<string> {
  const bytes = await fetchMallImageBytesValidated(url);
  return uploadBuffer(bytes, "detail");
}

/** cover·thumbnail을 한 번 fetch한 바이트로 함께 생성 (R2 URL 재-fetch 방지) */
async function migrateCoverWithThumbnail(sourceUrl: string): Promise<{ imageUrl: string; thumbnailUrl: string }> {
  const bytes = await fetchMallImageBytesValidated(sourceUrl);
  const imageUrl = await uploadBuffer(bytes, "cover");
  const thumbnailUrl = await uploadBuffer(bytes, "thumbnail");
  return { imageUrl, thumbnailUrl };
}

async function createThumbnailOnly(sourceUrl: string): Promise<string> {
  const bytes = await fetchMallImageBytesValidated(sourceUrl);
  return uploadBuffer(bytes, "thumbnail");
}

async function warnIfPublicCdnUnreachable(): Promise<void> {
  const base = getR2PublicBaseUrl();
  if (!base) return;
  try {
    const res = await fetch(base, { method: "HEAD", redirect: "follow" });
    if (!res.ok && res.status !== 403 && res.status !== 404) {
      console.warn(`⚠ R2 public URL 응답 ${res.status}: ${base}`);
    }
  } catch {
    console.warn(
      `⚠ R2 public URL에 연결할 수 없습니다: ${base}\n` +
        "  → Cloudflare R2 Public URL(pub-....r2.dev)을 R2_PUBLIC_BASE_URL로 쓰거나 cdn DNS를 연결하세요.\n" +
        "  (R2 업로드는 되더라도 브라우저에서 이미지가 안 보일 수 있습니다.)\n",
    );
  }
}

async function main() {
  if (!process.env.MONGODB_URI?.trim()) {
    console.error("MONGODB_URI가 없습니다.");
    process.exit(1);
  }
  if (!isR2Configured()) {
    console.error("R2 Secrets 5개가 설정되어 있지 않습니다.");
    process.exit(1);
  }

  console.log(`R2 bucket: ${getR2BucketNameForLog()}`);
  console.log(`R2 public URL: ${getR2PublicBaseUrl() || "(empty)"}`);
  console.log(`이미지 fetch BASE: ${(process.env.BASE_URL || "https://ppamong.com").replace(/\/+$/, "")}`);
  await warnIfPublicCdnUnreachable();
  console.log("");

  await connectMongoDB();

  const products = (await GoodsProductModel.find({}).lean()) as ProductDoc[];
  console.log(`상품 ${products.length}건 검사 (${dryRun ? "dry-run" : "적용"})`);

  let coverMigrated = 0;
  let detailMigrated = 0;
  let thumbCreated = 0;
  let skipped = 0;
  let failed = 0;

  for (const product of products) {
    const label = `#${product.id} ${product.name}`;
    const originalImageUrl = product.imageUrl?.trim() ?? "";

    try {
      let nextImageUrl = originalImageUrl;
      let nextThumbnailUrl = product.thumbnailUrl?.trim() ?? "";
      const nextDetailImages = [...(product.detailImages ?? [])];
      let changed = false;

      const needsCover = !thumbnailsOnly && nextImageUrl && !isR2PublicUrl(nextImageUrl);
      const needsThumb = !nextThumbnailUrl || !isR2PublicUrl(nextThumbnailUrl);
      const thumbSourceExternal =
        originalImageUrl && !isR2PublicUrl(originalImageUrl) ? originalImageUrl : "";

      if (needsCover) {
        if (dryRun) {
          console.log(`[dry-run] cover+thumbnail: ${label}`);
          coverMigrated += 1;
          if (needsThumb) thumbCreated += 1;
          changed = true;
        } else {
          const migrated = await migrateCoverWithThumbnail(nextImageUrl);
          nextImageUrl = migrated.imageUrl;
          if (needsThumb) {
            nextThumbnailUrl = migrated.thumbnailUrl;
            thumbCreated += 1;
            console.log(`cover+thumbnail → R2: ${label}`);
          } else {
            console.log(`cover → R2: ${label}`);
          }
          coverMigrated += 1;
          changed = true;
        }
      } else if (needsThumb && thumbSourceExternal) {
        if (dryRun) {
          console.log(`[dry-run] thumbnail: ${label}`);
          thumbCreated += 1;
          changed = true;
        } else {
          nextThumbnailUrl = await createThumbnailOnly(thumbSourceExternal);
          thumbCreated += 1;
          changed = true;
          console.log(`thumbnail 생성: ${label}`);
        }
      }

      if (!thumbnailsOnly) {
        for (let i = 0; i < nextDetailImages.length; i += 1) {
          const url = nextDetailImages[i]?.trim() ?? "";
          if (!url || isR2PublicUrl(url)) continue;
          if (dryRun) {
            console.log(`[dry-run] detail migrate: ${label} [${i + 1}]`);
            detailMigrated += 1;
            changed = true;
          } else {
            nextDetailImages[i] = await migrateDetailUrl(url);
            detailMigrated += 1;
            changed = true;
            console.log(`detail → R2: ${label} [${i + 1}]`);
          }
        }
      }

      if (!changed) {
        skipped += 1;
        continue;
      }

      if (!dryRun) {
        await GoodsProductModel.updateOne(
          { id: product.id },
          {
            imageUrl: nextImageUrl,
            thumbnailUrl: nextThumbnailUrl,
            detailImages: nextDetailImages,
            updatedAt: new Date(),
          },
        );
      }
    } catch (error) {
      failed += 1;
      console.error(`실패 ${label}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log("\n=== 결과 ===");
  console.log(`cover R2 이전: ${coverMigrated}`);
  console.log(`detail R2 이전: ${detailMigrated}`);
  console.log(`썸네일 생성: ${thumbCreated}`);
  console.log(`변경 없음: ${skipped}`);
  console.log(`실패: ${failed}`);

  await disconnectMongoDB();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
