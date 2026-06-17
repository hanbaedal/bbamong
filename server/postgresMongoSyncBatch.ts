import { syncPostgresToMongo, getPgMongoSyncMode } from "./storage/postgresToMongoSync";
import { isPostgresConfigured } from "./storage/postgresClient";
import { scheduleDailyKst } from "./utils/kstSchedule";

let cancelSchedule: (() => void) | null = null;

export function startPostgresMongoSyncBatch(): void {
  if (!isPostgresConfigured()) {
    console.log("[PgMongoSync] PostgreSQL 미설정 — PostgreSQL→MongoDB 자동 동기화 비활성");
    return;
  }

  if (process.env.PG_MONGO_SYNC_ENABLED !== "true") {
    console.log("[PgMongoSync] PG_MONGO_SYNC_ENABLED≠true — 자동 동기화 비활성 (PPAMONG 독립 운영)");
    return;
  }

  if (cancelSchedule) return;

  const hourKst = parseInt(process.env.PG_MONGO_SYNC_HOUR_KST || "1", 10);
  const minuteKst = parseInt(process.env.PG_MONGO_SYNC_MINUTE_KST || "0", 10);
  const safeHour = Number.isFinite(hourKst) ? Math.min(23, Math.max(0, hourKst)) : 1;
  const safeMinute = Number.isFinite(minuteKst) ? Math.min(59, Math.max(0, minuteKst)) : 0;
  const mode = getPgMongoSyncMode();

  const run = async () => {
    try {
      console.log(`[PgMongoSync] 자동 동기화 시작 (mode=${mode})`);
      await syncPostgresToMongo();
    } catch (error) {
      console.error("[PgMongoSync] 자동 동기화 실패:", error);
    }
  };

  cancelSchedule = scheduleDailyKst(safeHour, safeMinute, run);

  console.log(
    `[PgMongoSync] 매일 KST ${String(safeHour).padStart(2, "0")}:${String(safeMinute).padStart(2, "0")} 자동 동기화 예약 (mode=${mode})`,
  );
  if (process.env.PG_DATABASE_NAME?.trim()) {
    console.log(`[PgMongoSync] PG_DATABASE_NAME=${process.env.PG_DATABASE_NAME.trim()}`);
  } else if (process.env.PGDATABASE?.trim()) {
    console.log(`[PgMongoSync] PGDATABASE=${process.env.PGDATABASE.trim()}`);
  }
}
