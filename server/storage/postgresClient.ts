import postgres from "postgres";

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
      `$1/${encodeURIComponent(dbName)}`,
    );
  }

  return trimmed;
}

export function getPostgresClient(): postgres.Sql | null {
  const url = process.env.DATABASE_URL;
  if (!url?.trim()) return null;
  return postgres(normalizeDatabaseUrl(url), { max: 1, connect_timeout: 10 });
}

export async function getPostgresDatabaseName(pg: postgres.Sql): Promise<string | null> {
  try {
    const rows = await pg<{ db: string }[]>`SELECT current_database() AS db`;
    return rows[0]?.db ?? null;
  } catch {
    return null;
  }
}
