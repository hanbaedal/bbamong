/**
 * 【일회용】 PostgreSQL → MongoDB passwordPlain 복사
 *
 * Replit Shell (1회만):
 *   bash sync-ppamong.sh
 *   npm run one-time:password-plain
 *
 * 완료 후 이 파일과 package.json 의 one-time:password-plain 스크립트를 삭제하세요.
 *
 * ※ PostgreSQL password 가 bcrypt($2b$...) 이면 원래 비밀번호는 복구할 수 없습니다.
 *    그 경우 BACKFILL_FALLBACK_TO_USERNAME=true 로 아이디를 임시 비밀번호로 넣을 수 있습니다.
 */
import bcrypt from "bcrypt";
import { connectMongoDB, disconnectMongoDB, AdminUserModel, UserModel } from "../server/UserStorage/db";
import { getPostgresClient, isPostgresConfigured } from "../server/storage/postgresClient";

const TABLES = [
  { pg: "admin_users", Model: AdminUserModel, label: "관리자" },
  { pg: "users", Model: UserModel, label: "회원" },
] as const;

function isBcrypt(s: string) {
  return s.startsWith("$2a$") || s.startsWith("$2b$") || s.startsWith("$2y$");
}

async function migrateTable(
  pgTable: string,
  Model: typeof AdminUserModel | typeof UserModel,
  label: string,
  useUsernameFallback: boolean,
) {
  const pg = getPostgresClient();
  if (!pg) throw new Error("PostgreSQL 연결 실패");

  let rows: { id: string; username?: string; password?: string | null; password_plain?: string | null }[];
  try {
    rows = (await pg.unsafe(
      `SELECT id, username, password, password_plain FROM "${pgTable}"`,
    )) as typeof rows;
  } catch {
    rows = (await pg.unsafe(`SELECT id, username, password FROM "${pgTable}"`)) as typeof rows;
  }
  await pg.end({ timeout: 2 }).catch(() => {});

  let plainOk = 0;
  let fallbackOk = 0;
  let skipped = 0;

  for (const row of rows) {
    const id = String(row.id);
    const fromPgPlain = row.password_plain?.trim();
    const pw = row.password?.trim() ?? "";

    let plain: string | null = null;
    if (fromPgPlain && !isBcrypt(fromPgPlain)) {
      plain = fromPgPlain;
    } else if (pw && !isBcrypt(pw)) {
      plain = pw;
    } else if (useUsernameFallback && row.username) {
      plain = row.username;
    }

    if (!plain) {
      skipped += 1;
      continue;
    }

    const hash = pw && isBcrypt(pw) && plain !== row.username ? pw : await bcrypt.hash(plain, 10);
    const res = await Model.updateOne({ id }, { password: hash, passwordPlain: plain });
    if (res.matchedCount === 0) {
      skipped += 1;
      continue;
    }

    if (pw && !isBcrypt(pw)) plainOk += 1;
    else if (useUsernameFallback && plain === row.username) fallbackOk += 1;
    else plainOk += 1;
  }

  console.log(`[${label}] 평문 저장: ${plainOk}건, 아이디→임시비밀번호: ${fallbackOk}건, 건너뜀: ${skipped}건`);
}

async function main() {
  if (!process.env.MONGODB_URI?.trim()) {
    console.error("MONGODB_URI 없음");
    process.exit(1);
  }
  if (!isPostgresConfigured()) {
    console.error("PostgreSQL Secrets 없음");
    process.exit(1);
  }

  const useUsernameFallback = process.env.BACKFILL_FALLBACK_TO_USERNAME === "true";
  console.log("=== 일회용 passwordPlain 마이그레이션 ===\n");
  if (useUsernameFallback) {
    console.log("모드: bcrypt만 있는 계정 → passwordPlain = username\n");
  }

  await connectMongoDB();
  try {
    for (const { pg, Model, label } of TABLES) {
      await migrateTable(pg, Model, label, useUsernameFallback);
    }
    console.log("\n완료. 이 스크립트 파일을 삭제하세요.");
  } finally {
    await disconnectMongoDB();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
