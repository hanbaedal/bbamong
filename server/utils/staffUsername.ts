import { AdminUserModel } from "../UserStorage/db";

const STAFF_USERNAME_PREFIX = "ppamong.";
export const STAFF_USERNAME_REGEX = /^ppamong\.\d+$/;
const STAFF_USERNAME_PATTERN = /^ppamong\.(\d+)$/;

/** 슈퍼바이저 등록(staff register)으로 생성된 관리자 아이디 */
export function isStaffRegisteredUsername(username: string): boolean {
  return STAFF_USERNAME_REGEX.test(username);
}

export type AdminPlatform = "ppamong" | "badminton9";

/** 관리자 계정 출처: 빠몽(ppamong.XX·슈퍼어드민) vs 빠던9 레거시 */
export function resolveAdminPlatform(username: string, userType: string): AdminPlatform {
  if (userType === "슈퍼어드민") return "ppamong";
  if (userType === "일반어드민" && isStaffRegisteredUsername(username)) return "ppamong";
  return "badminton9";
}

export const PPAMONG_ADMIN_MONGO_FILTER = {
  $or: [
    { userType: "슈퍼어드민" },
    { userType: "일반어드민", username: { $regex: STAFF_USERNAME_REGEX } },
  ],
};

export const BADMINTON9_ADMIN_MONGO_FILTER = {
  userType: "일반어드민",
  username: { $not: STAFF_USERNAME_REGEX },
};

/** 다음 일반어드민 아이디: ppamong.01, ppamong.02, … */
export async function getNextStaffUsername(): Promise<string> {
  const docs = await AdminUserModel.find({
    username: { $regex: /^ppamong\.\d+$/ },
  })
    .select("username")
    .lean();

  let maxNum = 0;
  for (const doc of docs) {
    const match = doc.username.match(STAFF_USERNAME_PATTERN);
    if (match) {
      maxNum = Math.max(maxNum, Number.parseInt(match[1], 10));
    }
  }

  return `${STAFF_USERNAME_PREFIX}${String(maxNum + 1).padStart(2, "0")}`;
}
