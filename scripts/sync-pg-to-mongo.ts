/**
 * PostgreSQL → MongoDB 전체 미러 동기화 (Replit Shell / 로컬)
 * 실행: npx tsx scripts/sync-pg-to-mongo.ts
 */
import { connectMongoDB, disconnectMongoDB } from "../server/UserStorage/db";
import { syncPostgresToMongo } from "../server/storage/postgresToMongoSync";
import { normalizeDatabaseUrl } from "../server/storage/postgresClient";

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL이 없습니다. Replit Secrets 또는 .env를 확인하세요.");
    process.exit(1);
  }
  if (!process.env.MONGODB_URI?.trim()) {
    console.error("MONGODB_URI가 없습니다.");
    process.exit(1);
  }

  const effectiveUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
  const dbHint = process.env.PG_DATABASE_NAME?.trim() || "(URI 경로)";
  console.log(`PostgreSQL 대상 DB: ${dbHint}`);
  console.log(`MongoDB: ${process.env.MONGODB_DB_NAME || "ppamong"}\n`);

  await connectMongoDB();
  try {
    const result = await syncPostgresToMongo();
    console.log("\n=== 동기화 결과 ===");
    console.log(`성공: ${result.success}`);
    console.log(`PG DB: ${result.pgDatabase ?? "?"}`);
    console.log(`메시지: ${result.message ?? ""}\n`);

    for (const row of result.tables) {
      const err = row.error ? ` | ${row.error}` : "";
      const skip = row.skipped ? " (건너뜀)" : "";
      console.log(
        `${row.pgTable.padEnd(22)} 읽음 ${String(row.read).padStart(6)} | 신규 ${String(row.upserted).padStart(6)} | 갱신 ${String(row.modified).padStart(6)}${skip}${err}`,
      );
    }

    if (result.countParity?.length) {
      console.log("\n=== PG vs Mongo 건수 ===");
      for (const row of result.countParity) {
        const mark = row.match ? "OK" : "!!";
        console.log(
          `[${mark}] ${row.pgTable.padEnd(22)} PG ${String(row.postgresCount).padStart(6)} | Mongo ${String(row.mongoCount).padStart(6)}`,
        );
      }
    }

    process.exit(result.success ? 0 : 1);
  } finally {
    await disconnectMongoDB();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
