import postgres from "postgres";

/** Neon 등에서 흔한 sslmode=req → require 보정 */
export function normalizeDatabaseUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  return trimmed.replace(/([?&])sslmode=req(?![u])(?=&|$)/i, "$1sslmode=require");
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
