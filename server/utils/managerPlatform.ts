import type { AdminPlatform } from "./staffUsername";

/** 빠몽 현장 운영자 (op1~op5) */
export const PPAMONG_OPERATOR_USERNAMES = ["op1", "op2", "op3", "op4", "op5"] as const;

export const PPAMONG_MANAGER_MONGO_FILTER = {
  userType: "매니저" as const,
  username: { $in: [...PPAMONG_OPERATOR_USERNAMES] },
};

export const BADMINTON9_MANAGER_MONGO_FILTER = {
  userType: "매니저" as const,
  username: { $nin: [...PPAMONG_OPERATOR_USERNAMES] },
};

export function isPpamongOperatorUsername(username: string): boolean {
  return (PPAMONG_OPERATOR_USERNAMES as readonly string[]).includes(username);
}

/** 운영자 계정 출처: 빠몽(op1~5) vs 빠던9 레거시 매니저 */
export function resolveManagerPlatform(username: string): AdminPlatform {
  return isPpamongOperatorUsername(username) ? "ppamong" : "badminton9";
}
