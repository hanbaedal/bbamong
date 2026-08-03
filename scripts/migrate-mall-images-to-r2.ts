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
import { fetchMallImageBytes } from "../server/lib/mallImageFetch";
import {
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

async function migrateImageUrl(url: string, kind: "cover" | "detail"): Promise<string> {
  const bytes = await fetchMallImageBytes(url);
  return uploadBuffer(bytes, kind);
}

async function ensureThumbnailFromSource(sourceUrl: string): Promise<string> {
  const bytes = await fetchMallImageBytes(sourceUrl);
  return uploadBuffer(bytes, "thumbnail");
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
    try {
      let nextImageUrl = product.imageUrl?.trim() ?? "";
      let nextThumbnailUrl = product.thumbnailUrl?.trim() ?? "";
      const nextDetailImages = [...(product.detailImages ?? [])];
      let changed = false;

      if (!thumbnailsOnly && nextImageUrl && !isR2PublicUrl(nextImageUrl)) {
        if (dryRun) {
          console.log(`[dry-run] cover migrate: ${label}`);
          coverMigrated += 1;
          changed = true;
        } else {
          nextImageUrl = await migrateImageUrl(nextImageUrl, "cover");
          if (isR2PublicUrl(nextImageUrl)) {
            coverMigrated += 1;
            changed = true;
            console.log(`cover → R2: ${label}`);
          }
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
            const migrated = await migrateImageUrl(url, "detail");
            if (migrated) {
              nextDetailImages[i] = migrated;
              detailMigrated += 1;
              changed = true;
              console.log(`detail → R2: ${label} [${i + 1}]`);
            }
          }
        }
      }

      const thumbSource = nextImageUrl || product.imageUrl?.trim() || "";
      if (thumbSource && (!nextThumbnailUrl || !isR2PublicUrl(nextThumbnailUrl))) {
        if (dryRun) {
          console.log(`[dry-run] thumbnail: ${label}`);
          thumbCreated += 1;
          changed = true;
        } else {
          nextThumbnailUrl = await ensureThumbnailFromSource(thumbSource);
          thumbCreated += 1;
          changed = true;
          console.log(`thumbnail 생성: ${label}`);
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
