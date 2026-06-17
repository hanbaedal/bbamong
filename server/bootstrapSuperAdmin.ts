import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { AdminUserModel } from "./UserStorage/db";

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
}
