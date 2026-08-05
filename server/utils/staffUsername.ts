import { AdminUserModel } from "../UserStorage/db";

const STAFF_USERNAME_PREFIX = "ppamong.";
export const STAFF_USERNAME_REGEX = /^ppamong\.\d+$/;
const STAFF_USERNAME_PATTERN = /^ppamong\.(\d+)$/;

/** 슈퍼바이저 등록(staff register)으로 생성된 관리자 아이디 */
export function isStaffRegisteredUsername(username: string): boolean {
  return STAFF_USERNAME_REGEX.test(username);
}

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
