/**
 * Neon/PostgreSQL — 어느 DB에 레거시 테이블·데이터가 있는지 탐색
 * 실행: npx tsx scripts/discover-pg-database.ts
 */
import {
  getPostgresConnectionSource,
  isPostgresConfigured,
  resolveDatabaseUrl,
} from "../server/storage/postgresClient";

function replaceDbName(url: string, dbName: string): string {
  return url.replace(/^(postgresql:\/\/[^/]+)\/[^?]*/i, `$1/${encodeURIComponent(dbName)}`);
}

function dbNameFromUrl(url: string): string | null {
  const m = url.match(/^postgresql:\/\/[^/]+\/([^?]+)/i);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

async function probeDatabase(baseUrl: string, dbName: string) {
  const url = replaceDbName(baseUrl, dbName);
  const postgres = (await import("postgres")).default;
  const pg = postgres(url, { max: 1, connect_timeout: 8 });

  try {
    await pg`SELECT 1`;
    const [{ n: tableCount }] = await pg<{ n: number }[]>`
      SELECT COUNT(*)::int AS n
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;

    let users: number | null = null;
    let adminUsers: number | null = null;
    let hasUsersTable = false;

    try {
      const rows = await pg<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM users`;
      hasUsersTable = true;
      users = rows[0]?.n ?? 0;
    } catch {
      users = null;
    }

    try {
      const rows = await pg<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM admin_users`;
      adminUsers = rows[0]?.n ?? 0;
    } catch {
      adminUsers = null;
    }

    return {
      dbName,
      ok: true,
      tableCount,
      hasUsersTable,
      users,
      adminUsers,
    };
  } catch (error: unknown) {
    return {
      dbName,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await pg.end({ timeout: 2 }).catch(() => {});
  }
}

async function main() {
  const baseUrl = resolveDatabaseUrl();
  if (!baseUrl || !isPostgresConfigured()) {
    console.error("PostgreSQL Secrets가 없습니다.");
    console.error("DATABASE_URL 또는 PGHOST·PGUSER·PGPASSWORD·PGDATABASE(ppadun9)를 설정하세요.");
    process.exit(1);
  }

  const current = dbNameFromUrl(baseUrl);
  const source = getPostgresConnectionSource();
  const candidates = Array.from(
    new Set(
      [
        current,
        process.env.PGDATABASE?.trim(),
        process.env.PG_DATABASE_NAME?.trim(),
        "heliumdb",
        "ppadun9",
        "neondb",
        "postgres",
      ].filter((v): v is string => !!v),
    ),
  );

  console.log("=== PostgreSQL DB 탐색 ===\n");
  console.log(`연결 방식: ${source === "pg-parts" ? "PGHOST·PGUSER·… (빠던9)" : "DATABASE_URL"}`);
  console.log(`대상 DB: ${current ?? "(없음)"}`);
  console.log(`PG_DATABASE_NAME: ${process.env.PG_DATABASE_NAME?.trim() || "(미설정)"}\n`);

  const results = [];
  for (const dbName of candidates) {
    process.stdout.write(`검사 중: ${dbName} ... `);
    const row = await probeDatabase(baseUrl, dbName);
    results.push(row);
    if (!row.ok) {
      console.log(`연결 실패 — ${row.error}`);
    } else if (!row.hasUsersTable) {
      console.log(`연결됨, public 테이블 ${row.tableCount}개, users 테이블 없음`);
    } else {
      console.log(
        `연결됨, users ${row.users}건, admin_users ${row.adminUsers ?? "?"}건 (public 테이블 ${row.tableCount}개)`,
      );
    }
  }

  const best = results
    .filter((r): r is Extract<typeof r, { ok: true; hasUsersTable: true }> => r.ok && r.hasUsersTable)
    .sort((a, b) => (b.users ?? 0) - (a.users ?? 0))[0];

  console.log("\n=== 권장 설정 ===");
  if (!best) {
    console.log("users 테이블이 있는 DB를 찾지 못했습니다.");
    console.log("- Neon 콘솔에서 실제 데이터가 있는 프로젝트/DB인지 확인하세요.");
    console.log("- 빠던9 Replit Shell에서: printenv DATABASE_URL  (다른 Neon URI일 수 있음)");
    console.log("- PGHOST=helium 은 Replit 내부 DB로, PPAMONG Repl에서는 접근 불가합니다.");
    console.log("- Secrets에 PG_DATABASE_NAME=heliumdb 후 다시 discover 해보세요.");
    process.exit(1);
  }

  console.log(`Replit Secrets 에 추가:`);
  console.log(`  PG_DATABASE_NAME=${best.dbName}`);
  console.log(`\n그다음:`);
  console.log(`  npm run sync:pg-to-mongo`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
