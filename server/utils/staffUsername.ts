import { AdminUserModel } from "../UserStorage/db";

const STAFF_USERNAME_PREFIX = "ppamong.";
const STAFF_USERNAME_PATTERN = /^ppamong\.(\d+)$/;

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
