import postgres from "postgres";

function encodeUriComponent(value: string): string {
  return encodeURIComponent(value);
}

/** Neon 등에서 흔한 sslmode=req → require 보정 */
export function normalizeDatabaseUrl(url: string): string {
  let trimmed = url.trim();
  if (!trimmed) return trimmed;
  trimmed = trimmed.replace(/([?&])sslmode=req(?![u])(?=&|$)/i, "$1sslmode=require");

  /** URI 경로 DB와 다를 때 Secrets의 PG_DATABASE_NAME(예: ppadun9)으로 덮어씀 */
  const dbName = process.env.PG_DATABASE_NAME?.trim();
  if (dbName) {
    trimmed = trimmed.replace(
      /^(postgresql:\/\/[^/]+)\/[^?]*/i,
      `$1/${encodeUriComponent(dbName)}`,
    );
  }

  return trimmed;
}

/** 빠던9 Replit 방식: PGHOST, PGUSER, PGPASSWORD, PGDATABASE */
function buildDatabaseUrlFromPgParts(): string | null {
  const host = process.env.PGHOST?.trim();
  const user = process.env.PGUSER?.trim();
  const password = process.env.PGPASSWORD;
  if (!host || !user || password === undefined || password === "") {
    return null;
  }

  const port = process.env.PGPORT?.trim() || "5432";
  const database =
    process.env.PGDATABASE?.trim() ||
    process.env.PG_DATABASE_NAME?.trim() ||
    "ppadun9";

  return `postgresql://${encodeUriComponent(user)}:${encodeUriComponent(password)}@${host}:${port}/${encodeUriComponent(database)}?sslmode=require`;
}

/**
 * PostgreSQL 연결 URI 결정
 * 1) PGHOST+PGUSER+PGPASSWORD (빠던9 Replit Secrets) — 우선
 * 2) DATABASE_URL
 */
export function resolveDatabaseUrl(): string | null {
  const fromParts = buildDatabaseUrlFromPgParts();
  if (fromParts) return fromParts;

  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  return normalizeDatabaseUrl(url);
}

export function getPostgresConnectionSource(): "pg-parts" | "database-url" | null {
  if (buildDatabaseUrlFromPgParts()) return "pg-parts";
  if (process.env.DATABASE_URL?.trim()) return "database-url";
  return null;
}

export function isPostgresConfigured(): boolean {
  return resolveDatabaseUrl() != null;
}

export function getPostgresClient(): postgres.Sql | null {
  const url = resolveDatabaseUrl();
  if (!url) return null;
  return postgres(url, { max: 1, connect_timeout: 10 });
}

export async function getPostgresDatabaseName(pg: postgres.Sql): Promise<string | null> {
  try {
    const rows = await pg<{ db: string }[]>`SELECT current_database() AS db`;
    return rows[0]?.db ?? null;
  } catch {
    return null;
  }
}
