/**
 * DB 환경변수 설정·연결 확인 (비밀번호 출력 없음)
 * 실행: node scripts/verify-db-config.mjs
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

function maskUrl(url) {
  try {
    const u = new URL(url.replace(/^mongodb(\+srv)?:\/\//, "http://"));
    const host = u.hostname || "(unknown)";
    const db = u.pathname?.replace(/^\//, "") || "";
    return `${host}${db ? "/" + db.split("?")[0] : ""}`;
  } catch {
    return "(invalid URL format)";
  }
}

function status(name, value) {
  const set = Boolean(value && String(value).trim());
  console.log(`  ${name}: ${set ? "설정됨" : "미설정"}`);
  return set;
}

loadDotEnv();

console.log("=== PPAMONG DB 설정 확인 ===\n");
console.log(`환경: ${process.env.NODE_ENV || "development"}`);
console.log(`로컬 .env 파일: ${fs.existsSync(envPath) ? "있음" : "없음"}\n`);

const hasMongo = status("MONGODB_URI", process.env.MONGODB_URI);
const hasPg = status("DATABASE_URL", process.env.DATABASE_URL);
status("JWT_SECRET", process.env.JWT_SECRET);
status("JWT_REFRESH_SECRET", process.env.JWT_REFRESH_SECRET);

console.log("");

if (hasMongo) {
  console.log(`MongoDB 대상: ${maskUrl(process.env.MONGODB_URI)}`);
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
  console.log("MongoDB: MONGODB_URI 미설정 — Replit Secrets 또는 .env에 추가 필요");
}

console.log("");

if (hasPg) {
  console.log(`PostgreSQL 대상: ${maskUrl(process.env.DATABASE_URL)}`);
  try {
    const postgres = (await import("postgres")).default;
    const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 8 });
    const rows = await sql`SELECT current_database() AS db, current_user AS usr`;
    const count = await sql`SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log(
      `  ✓ PostgreSQL 연결 성공 (DB: ${rows[0]?.db}, 사용자: ${rows[0]?.usr}, public 테이블 ${count[0]?.n}개)`,
    );
    await sql.end();
  } catch (err) {
    console.log(`  ✗ PostgreSQL 연결 실패: ${err.message}`);
    if (/password authentication failed/i.test(err.message)) {
      console.log("    → 비밀번호가 틀렸거나 URI의 USER/PASSWORD를 확인하세요.");
    }
    if (/ENOTFOUND|ECONNREFUSED|timeout/i.test(err.message)) {
      console.log("    → 호스트·포트·네트워크(Neon SSL)를 확인하세요.");
    }
  }
} else {
  console.log(
    "PostgreSQL: DATABASE_URL 미설정 — 관리자 [디비 백업하기]에서 「미설정」으로 표시됩니다.",
  );
}

console.log("\n=== 운영 서버(Replit) 확인 방법 ===");
console.log("1. Replit → Tools → Secrets 에 MONGODB_URI, DATABASE_URL 존재 여부 확인");
console.log("2. Secrets 변경 후 Deploy/Repl 재시작 필수");
console.log("3. 관리자 웹 → 업무 관리 → 디비 백업하기");
console.log("   - 빨간 「미설정」 문구가 사라지고 PostgreSQL 건수 열이 보이면 연결 성공");
