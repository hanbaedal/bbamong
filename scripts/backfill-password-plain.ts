/**
 * MongoDB passwordPlain 백필
 * - password 필드가 평문이면 bcrypt + passwordPlain 저장
 * - 슈퍼바이저(ppamong) passwordPlain 보완
 * - bcrypt만 있는 계정은 평문 복구 불가 (관리자 화면 재설정 또는 로그인 1회)
 *
 * 실행: npm run backfill:password-plain
 */
import bcrypt from "bcrypt";
import {
  connectMongoDB,
  disconnectMongoDB,
  AdminUserModel,
  UserModel,
} from "../server/UserStorage/db";

const SUPER_USERNAME = "ppamong";
const SUPER_DEFAULT_PASSWORD = "ppamong.0323";

function isBcryptHash(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$"))
  );
}

async function backfillCollection(
  Model: typeof AdminUserModel | typeof UserModel,
  label: string,
  isAdmin: boolean,
) {
  let plainFixed = 0;
  let plainAdded = 0;
  let bcryptOnly = 0;

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

    bcryptOnly += 1;
  }

  console.log(`[${label}] 평문→bcrypt+passwordPlain: ${plainFixed}건`);
  console.log(`[${label}] passwordPlain 추가: ${plainAdded}건`);
  console.log(`[${label}] bcrypt만 있음(로그인·재설정 필요): ${bcryptOnly}건`);
}

async function main() {
  if (!process.env.MONGODB_URI?.trim()) {
    console.error("MONGODB_URI가 없습니다.");
    process.exit(1);
  }

  await connectMongoDB();
  try {
    console.log("=== passwordPlain 백필 ===\n");
    await backfillCollection(AdminUserModel, "admin_users", true);
    await backfillCollection(UserModel, "users", false);
    console.log("\n완료.");
  } finally {
    await disconnectMongoDB();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
