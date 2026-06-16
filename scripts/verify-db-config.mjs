/**
 * DB 환경변수 설정·연결 확인 (비밀번호 출력 없음)
 * 실행: npm run check:db  또는 node scripts/verify-db-config.mjs
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

function maskMongoUrl(url) {
  try {
    const u = new URL(url.replace(/^mongodb(\+srv)?:\/\//, "http://"));
    const host = u.hostname || "(unknown)";
    const db = u.pathname?.replace(/^\//, "") || "";
    return `${host}${db ? "/" + db.split("?")[0] : ""}`;
  } catch {
    return "(invalid)";
  }
}

function maskPgUrl(url) {
  try {
    const u = new URL(url.replace(/^postgresql:\/\//, "http://"));
    const db = u.pathname?.replace(/^\//, "").split("?")[0] || "";
    return `${u.hostname}${db ? "/" + db : ""}`;
  } catch {
    return "(invalid)";
  }
}

function status(name, value) {
  const set = Boolean(value && String(value).trim());
  console.log(`  ${name}: ${set ? "설정됨" : "미설정"}`);
  return set;
}

function encode(v) {
  return encodeURIComponent(v);
}

function resolvePgUrl() {
  const host = process.env.PGHOST?.trim();
  const user = process.env.PGUSER?.trim();
  const password = process.env.PGPASSWORD;
  if (host && user && password !== undefined && password !== "") {
    const port = process.env.PGPORT?.trim() || "5432";
    const db =
      process.env.PGDATABASE?.trim() ||
      process.env.PG_DATABASE_NAME?.trim() ||
      "ppadun9";
    return `postgresql://${encode(user)}:${encode(password)}@${host}:${port}/${encode(db)}?sslmode=require`;
  }
  return process.env.DATABASE_URL?.trim() || null;
}

loadDotEnv();

console.log("=== PPAMONG DB 설정 확인 ===\n");
console.log(`환경: ${process.env.NODE_ENV || "development"}`);
console.log(`로컬 .env 파일: ${fs.existsSync(envPath) ? "있음" : "없음"}\n`);

const hasMongo = status("MONGODB_URI", process.env.MONGODB_URI);
const hasPgParts =
  status("PGHOST", process.env.PGHOST) &&
  status("PGUSER", process.env.PGUSER) &&
  status("PGPASSWORD", process.env.PGPASSWORD);
status("PGDATABASE", process.env.PGDATABASE);
const hasPgUrl = status("DATABASE_URL", process.env.DATABASE_URL);
status("JWT_SECRET", process.env.JWT_SECRET);
status("JWT_REFRESH_SECRET", process.env.JWT_REFRESH_SECRET);

console.log("");
console.log("PostgreSQL 상세 점검: npm run check:pg-secrets\n");

if (hasMongo) {
  console.log(`MongoDB 대상: ${maskMongoUrl(process.env.MONGODB_URI)}`);
  try {
    const mongoose = (await import("mongoose")).default;
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB_NAME || "ppamong",
      serverSelectionTimeoutMS: 8000,
    });
    const dbName = mongoose.connection.db?.databaseName;
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`  ✓ MongoDB 연결 성공 (DB: ${dbName}, 컬렉션 ${collections.length}개)`);
    await mongoose.disconnect();
  } catch (err) {
    console.log(`  ✗ MongoDB 연결 실패: ${err.message}`);
  }
} else {
  console.log("MongoDB: MONGODB_URI 미설정");
}

console.log("");

const pgUrl = resolvePgUrl();
if (pgUrl) {
  console.log(`PostgreSQL 대상: ${maskPgUrl(pgUrl)}`);
  try {
    const postgres = (await import("postgres")).default;
    const sql = postgres(pgUrl, { max: 1, connect_timeout: 8 });
    const rows = await sql`SELECT current_database() AS db, current_user AS usr`;
    const count = await sql`SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`;
    let users = "?";
    try {
      const u = await sql`SELECT COUNT(*)::int AS n FROM users`;
      users = String(u[0]?.n ?? 0);
    } catch {
      users = "테이블 없음";
    }
    console.log(
      `  ✓ PostgreSQL 연결 (DB: ${rows[0]?.db}, public ${count[0]?.n}개, users: ${users})`,
    );
    await sql.end();
  } catch (err) {
    console.log(`  ✗ PostgreSQL 연결 실패: ${err.message}`);
  }
} else if (!hasPgParts && !hasPgUrl) {
  console.log("PostgreSQL: PGHOST 또는 DATABASE_URL 미설정");
}

console.log("\n=== 빠던9 → MongoDB 가져오기 ===");
console.log("npm run setup:legacy-pg");
