import { syncPostgresToMongo } from "./storage/postgresToMongoSync";

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000;

let intervalId: NodeJS.Timeout | null = null;

export function startPostgresMongoSyncBatch(): void {
  if (!process.env.DATABASE_URL) {
    console.log("[PgMongoSync] DATABASE_URL 미설정 — PostgreSQL→MongoDB 자동 동기화 비활성");
    return;
  }

  if (process.env.PG_MONGO_SYNC_ENABLED !== "true") {
    console.log("[PgMongoSync] PG_MONGO_SYNC_ENABLED≠true — 자동 동기화 비활성 (PPAMONG 독립 운영)");
    return;
  }

  if (intervalId) return;

  const intervalMs = parseInt(process.env.PG_MONGO_SYNC_INTERVAL_MS || String(DEFAULT_INTERVAL_MS), 10);
  const safeInterval = Number.isFinite(intervalMs) && intervalMs >= 60_000 ? intervalMs : DEFAULT_INTERVAL_MS;

  const run = async () => {
    try {
      await syncPostgresToMongo();
    } catch (error) {
      console.error("[PgMongoSync] 자동 동기화 실패:", error);
    }
  };

  console.log(`[PgMongoSync] 자동 동기화 시작 (간격 ${Math.round(safeInterval / 60000)}분)`);
  if (process.env.PG_DATABASE_NAME?.trim()) {
    console.log(`[PgMongoSync] PG_DATABASE_NAME=${process.env.PG_DATABASE_NAME.trim()}`);
  }
  void run();
  intervalId = setInterval(run, safeInterval);
}
