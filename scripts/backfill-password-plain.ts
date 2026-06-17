/**
 * MongoDB passwordPlain 백필
 *
 * 1) PostgreSQL users / admin_users 에서 평문 비밀번호 읽어 MongoDB 반영
 * 2) password 필드가 평문이면 bcrypt + passwordPlain 저장
 * 3) 슈퍼바이저(ppamong) passwordPlain 보완
 * 4) BACKFILL_FALLBACK_TO_USERNAME=true 이면 남은 계정은 passwordPlain=username, password 재해시
 *
 * Replit Shell:
 *   npm run backfill:password-plain
 *   BACKFILL_FALLBACK_TO_USERNAME=true npm run backfill:password-plain
 */
import bcrypt from "bcrypt";
import {
  connectMongoDB,
  disconnectMongoDB,
  AdminUserModel,
  UserModel,
} from "../server/UserStorage/db";
import {
  getPostgresClient,
  isPostgresConfigured,
  resolveDatabaseUrl,
} from "../server/storage/postgresClient";

const SUPER_USERNAME = "ppamong";
const SUPER_DEFAULT_PASSWORD = "ppamong.0323";

function isBcryptHash(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$"))
  );
}

type PgPasswordRow = { id: string; username?: string; password?: string | null; password_plain?: string | null };

async function loadPgPasswords(table: "users" | "admin_users"): Promise<Map<string, PgPasswordRow>> {
  const map = new Map<string, PgPasswordRow>();
  if (!isPostgresConfigured()) return map;

  const pg = getPostgresClient();
  if (!pg) return map;

  try {
    let rows: PgPasswordRow[] = [];
    try {
      rows = (await pg.unsafe(
        `SELECT id, username, password, password_plain FROM "${table}"`,
      )) as PgPasswordRow[];
    } catch {
      rows = (await pg.unsafe(
        `SELECT id, username, password FROM "${table}"`,
      )) as PgPasswordRow[];
    }
    for (const row of rows) {
      if (row.id) map.set(String(row.id), row);
    }
  } finally {
    await pg.end({ timeout: 2 }).catch(() => {});
  }

  return map;
}

async function applyPgPassword(
  Model: typeof AdminUserModel | typeof UserModel,
  pgMap: Map<string, PgPasswordRow>,
): Promise<number> {
  let updated = 0;

  for (const [id, pgRow] of pgMap) {
    const explicitPlain = pgRow.password_plain?.trim();
    const pw = pgRow.password?.trim();
    let plain: string | null = null;
    let hash: string | null = null;

    if (explicitPlain && !isBcryptHash(explicitPlain)) {
      plain = explicitPlain;
      hash = pw && isBcryptHash(pw) ? pw : await bcrypt.hash(explicitPlain, 10);
    } else if (pw && !isBcryptHash(pw)) {
      plain = pw;
      hash = await bcrypt.hash(pw, 10);
    } else if (pw && isBcryptHash(pw)) {
      hash = pw;
    }

    if (!plain) continue;

    const res = await Model.updateOne(
      { id },
      { password: hash ?? undefined, passwordPlain: plain },
    );
    if (res.matchedCount > 0) updated += 1;
  }

  return updated;
}

async function backfillCollection(
  Model: typeof AdminUserModel | typeof UserModel,
  label: string,
  isAdmin: boolean,
  pgMap: Map<string, PgPasswordRow>,
  fallbackToUsername: boolean,
) {
  let plainFixed = 0;
  let plainAdded = 0;
  let fromPg = 0;
  let fallbackApplied = 0;
  let bcryptOnly = 0;

  fromPg = await applyPgPassword(Model, pgMap);

  const docs = await Model.find({ password: { $exists: true, $ne: null } })
    .select("id username password passwordPlain")
    .lean();

  for (const doc of docs) {
    const row = doc as { id: string; username?: string; password?: string; passwordPlain?: string };
    const pw = row.password;
    if (typeof pw !== "string" || !pw) continue;

    if (!isBcryptHash(pw)) {
      await Model.updateOne(
        { id: row.id },
        { password: await bcrypt.hash(pw, 10), passwordPlain: pw },
      );
      plainFixed += 1;
      continue;
    }

    if (row.passwordPlain) continue;

    if (isAdmin && row.username === SUPER_USERNAME) {
      await Model.updateOne({ id: row.id }, { passwordPlain: SUPER_DEFAULT_PASSWORD });
      plainAdded += 1;
      continue;
    }

    if (fallbackToUsername && row.username) {
      const plain = row.username;
      await Model.updateOne(
        { id: row.id },
        { password: await bcrypt.hash(plain, 10), passwordPlain: plain },
      );
      fallbackApplied += 1;
      continue;
    }

    bcryptOnly += 1;
  }

  console.log(`[${label}] PostgreSQL에서 평문 반영: ${fromPg}건`);
  console.log(`[${label}] Mongo 평문→bcrypt+passwordPlain: ${plainFixed}건`);
  console.log(`[${label}] 슈퍼바이저 passwordPlain 추가: ${plainAdded}건`);
  if (fallbackToUsername) {
    console.log(`[${label}] username을 임시 비밀번호로 설정: ${fallbackApplied}건`);
  }
  console.log(`[${label}] bcrypt만 있음(미처리): ${bcryptOnly}건`);
}

async function main() {
  if (!process.env.MONGODB_URI?.trim()) {
    console.error("MONGODB_URI가 없습니다.");
    process.exit(1);
  }

  const fallbackToUsername = process.env.BACKFILL_FALLBACK_TO_USERNAME === "true";
  const pgUrl = resolveDatabaseUrl();

  console.log("=== passwordPlain 백필 ===\n");
  console.log(`PostgreSQL: ${pgUrl ? "연결 시도" : "미설정"}`);
  console.log(
    `임시 비밀번호(username): ${fallbackToUsername ? "켜짐" : "꺼짐 (bcrypt만 있으면 BACKFILL_FALLBACK_TO_USERNAME=true)"}\n`,
  );

  const [pgUsers, pgAdmins] = await Promise.all([
    loadPgPasswords("users"),
    loadPgPasswords("admin_users"),
  ]);

  await connectMongoDB();
  try {
    await backfillCollection(AdminUserModel, "admin_users", true, pgAdmins, fallbackToUsername);
    console.log("");
    await backfillCollection(UserModel, "users", false, pgUsers, fallbackToUsername);
    console.log("\n완료.");
  } finally {
    await disconnectMongoDB();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
