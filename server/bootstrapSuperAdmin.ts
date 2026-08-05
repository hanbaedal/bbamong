import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { AdminUserModel } from "./UserStorage/db";
import { STAFF_USERNAME_REGEX } from "./utils/staffUsername";

const SUPER_ADMIN_USERNAME = "ppamong";
const SUPER_ADMIN_EMAIL = "ppamong@ppamong.com";
const SUPER_ADMIN_DEFAULT_PASSWORD = "ppamong.0323";
const SUPER_ADMIN_NAME = "슈퍼바이저";

/**
 * 슈퍼바이저(슈퍼어드민) 계정이 없으면 ppamong 계정을 생성합니다.
 * 서버 기동 시 1회 실행됩니다.
 */
export async function ensureSuperAdmin(): Promise<void> {
  const existing = await AdminUserModel.findOne({ username: SUPER_ADMIN_USERNAME }).lean();

  if (!existing) {
    const hashedPassword = await bcrypt.hash(SUPER_ADMIN_DEFAULT_PASSWORD, 10);
    await AdminUserModel.create({
      id: randomUUID(),
      username: SUPER_ADMIN_USERNAME,
      email: SUPER_ADMIN_EMAIL,
      name: SUPER_ADMIN_NAME,
      password: hashedPassword,
      passwordPlain: SUPER_ADMIN_DEFAULT_PASSWORD,
      phone: "01000000000",
      department: "본사",
      position: "슈퍼바이저",
      userType: "슈퍼어드민",
      approvalStatus: "승인",
      status: "활성화",
    });
    console.log("[Bootstrap] 슈퍼바이저 계정 생성: ppamong");
    await cleanupLegacyStaffAdmins();
    return;
  }

  const updates: Record<string, unknown> = {};
  if (existing.userType !== "슈퍼어드민") updates.userType = "슈퍼어드민";
  if (existing.approvalStatus !== "승인") updates.approvalStatus = "승인";
  if (existing.status !== "활성화") updates.status = "활성화";

  if (process.env.PPAMONG_SUPER_ADMIN_RESET === "true") {
    updates.password = await bcrypt.hash(SUPER_ADMIN_DEFAULT_PASSWORD, 10);
    updates.passwordPlain = SUPER_ADMIN_DEFAULT_PASSWORD;
    console.log("[Bootstrap] 슈퍼바이저 비밀번호 초기화 (PPAMONG_SUPER_ADMIN_RESET=true)");
  } else if (!existing.passwordPlain) {
    updates.passwordPlain = SUPER_ADMIN_DEFAULT_PASSWORD;
  }

  if (Object.keys(updates).length > 0) {
    await AdminUserModel.updateOne({ username: SUPER_ADMIN_USERNAME }, updates);
    console.log("[Bootstrap] 슈퍼바이저 계정 설정 갱신: ppamong");
  }

  await cleanupLegacyStaffAdmins();
}

/** 빠던9(PostgreSQL)에서 동기화된 레거시 일반어드민 삭제 — ppamong.XX 등록 관리자만 유지 */
export async function cleanupLegacyStaffAdmins(): Promise<number> {
  const result = await AdminUserModel.deleteMany({
    userType: "일반어드민",
    username: { $not: STAFF_USERNAME_REGEX },
  });
  const deleted = result.deletedCount ?? 0;
  if (deleted > 0) {
    console.log(`[Bootstrap] 레거시 일반어드민 ${deleted}건 삭제 (ppamong.XX 등록 관리자만 유지)`);
  }
  return deleted;
}
