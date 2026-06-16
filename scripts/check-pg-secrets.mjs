/**
 * PostgreSQL Secrets 점검 (비밀번호·전체 URI 미출력)
 * Replit Shell: npm run check:pg-secrets
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

function loadDotEnv() {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function isSet(name) {
  const v = process.env[name];
  return Boolean(v && String(v).trim());
}

function maskPgUrl(url) {
  try {
    const u = new URL(url.replace(/^postgresql:\/\//, "http://"));
    const db = u.pathname?.replace(/^\//, "").split("?")[0] || "?";
    return `${u.hostname}/${db}`;
  } catch {
    return "(URI 형식 오류)";
  }
}

function encode(v) {
  return encodeURIComponent(v);
}

function normalizeDatabaseUrl(url) {
  let trimmed = url.trim();
  trimmed = trimmed.replace(/([?&])sslmode=req(?![u])(?=&|$)/i, "$1sslmode=require");
  const dbName = process.env.PG_DATABASE_NAME?.trim();
  if (dbName) {
    trimmed = trimmed.replace(
      /^(postgresql:\/\/[^/]+)\/[^?]*/i,
      `$1/${encode(dbName)}`,
    );
  }
  return trimmed;
}

function resolveDatabaseUrl() {
  const host = process.env.PGHOST?.trim();
  const user = process.env.PGUSER?.trim();
  const password = process.env.PGPASSWORD;
  if (host && user && password !== undefined && password !== "") {
    const port = process.env.PGPORT?.trim() || "5432";
    const database =
      process.env.PGDATABASE?.trim() ||
      process.env.PG_DATABASE_NAME?.trim() ||
      "ppadun9";
    return {
      source: "pg-parts",
      url: `postgresql://${encode(user)}:${encode(password)}@${host}:${port}/${encode(database)}?sslmode=require`,
      database,
      host,
    };
  }
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  const normalized = normalizeDatabaseUrl(url);
  const m = normalized.match(/^postgresql:\/\/[^/]+\/([^?]+)/i);
  return {
    source: "database-url",
    url: normalized,
    database: m?.[1] ? decodeURIComponent(m[1]) : "?",
    host: maskPgUrl(normalized).split("/")[0],
  };
}

loadDotEnv();

console.log("=== PostgreSQL Secrets 점검 (PPAMONG Replit) ===\n");

const pgParts = [
  ["PGHOST", "빠던9 Neon 호스트 (ep-....neon.tech)"],
  ["PGPORT", "5432"],
  ["PGUSER", "예: neondb_owner"],
  ["PGPASSWORD", "비밀번호 (값은 표시 안 함)"],
  ["PGDATABASE", "ppadun9 권장"],
];

console.log("【빠던9 방식 — PGHOST 등】");
let partsOk = 0;
for (const [key, hint] of pgParts) {
  const ok = isSet(key);
  if (ok) partsOk += 1;
  let extra = "";
  if (key === "PGHOST" && ok) extra = ` → ${process.env.PGHOST.trim()}`;
  if (key === "PGDATABASE" && ok) extra = ` → ${process.env.PGDATABASE.trim()}`;
  console.log(`  ${ok ? "✓" : "✗"} ${key.padEnd(14)} ${ok ? "설정됨" : "미설정"}  ${hint}${extra}`);
}

console.log("\n【또는 DATABASE_URL】");
const hasUrl = isSet("DATABASE_URL");
console.log(`  ${hasUrl ? "✓" : "✗"} DATABASE_URL   ${hasUrl ? "설정됨" : "미설정"}`);
if (hasUrl) {
  console.log(`      대상(마스킹): ${maskPgUrl(process.env.DATABASE_URL)}`);
}
console.log(`  ${isSet("PG_DATABASE_NAME") ? "✓" : "·"} PG_DATABASE_NAME  ${process.env.PG_DATABASE_NAME?.trim() || "(미설정, URI DB 이름 덮어쓰기용)"}`);

const resolved = resolveDatabaseUrl();
console.log("\n【실제 연결에 쓰이는 설정】");
if (!resolved) {
  console.log("  ✗ PostgreSQL 연결 정보 없음\n");
  console.log("=== 해야 할 일 ===");
  console.log("1. 빠던9 Replit → Tools → Secrets 열기");
  console.log("2. PGHOST, PGUSER, PGPASSWORD, PGDATABASE=ppadun9 복사");
  console.log("   (또는 DATABASE_URL 전체 — /ppadun9 가 포함된 URI)");
  console.log("3. PPAMONG Replit Secrets에 붙여넣기 → Repl 재시작");
  console.log("4. npm run discover:pg-db");
  process.exit(1);
}

console.log(`  연결 방식: ${resolved.source === "pg-parts" ? "PGHOST·PGUSER·… (빠던9, 우선)" : "DATABASE_URL"}`);
console.log(`  호스트/DB: ${resolved.host} / ${resolved.database}`);

if (resolved.source === "database-url" && resolved.database === "neondb" && partsOk === 0) {
  console.log("\n  ⚠ DATABASE_URL만 있고 DB가 neondb 입니다. 빈 Neon일 수 있습니다.");
  console.log("    → 빠던9 Secrets의 PGHOST·PGDATABASE=ppadun9 를 추가하세요.");
}

console.log("\n【연결 테스트】");
try {
  const postgres = (await import("postgres")).default;
  const pg = postgres(resolved.url, { max: 1, connect_timeout: 10 });
  const [{ db }] = await pg`SELECT current_database() AS db`;
  const [{ n: tableCount }] = await pg`
    SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'
  `;
  let users = null;
  try {
    const [{ n }] = await pg`SELECT COUNT(*)::int AS n FROM users`;
    users = n;
  } catch {
    users = "(테이블 없음)";
  }
  await pg.end();
  console.log(`  ✓ 연결 성공 — DB: ${db}, public 테이블 ${tableCount}개, users: ${users}`);
  if (users === 0 || users === "(테이블 없음)") {
    console.log("\n  ⚠ ERD 테이블(users 등)이 없거나 비어 있습니다. 호스트/DB가 빠던9와 다릅니다.");
    console.log("    → npm run discover:pg-db");
    process.exit(1);
  }
  console.log("\n=== 다음 단계 ===");
  console.log("  npm run sync:pg-to-mongo");
  console.log("  (완료 후 Deploy)");
  process.exit(0);
} catch (err) {
  console.log(`  ✗ 연결 실패: ${err.message}`);
  process.exit(1);
}
