/**
 * 빠던9(PostgreSQL)에서 동기화된 레거시 일반어드민 삭제
 * ppamong.XX 형식(staff register) 관리자만 유지
 *
 * 실행: npx tsx scripts/cleanup-legacy-staff-admins.ts
 */
import { connectMongoDB, disconnectMongoDB } from "../server/UserStorage/db";
import { cleanupLegacyStaffAdmins } from "../server/bootstrapSuperAdmin";

async function main() {
  if (!process.env.MONGODB_URI?.trim()) {
    console.error("MONGODB_URI가 없습니다.");
    process.exit(1);
  }

  await connectMongoDB();
  try {
    const deleted = await cleanupLegacyStaffAdmins();
    console.log(deleted > 0 ? `완료: ${deleted}건 삭제` : "삭제할 레거시 일반어드민 없음");
  } finally {
    await disconnectMongoDB();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
