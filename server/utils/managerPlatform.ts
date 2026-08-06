import type { AdminPlatform } from "./staffUsername";
import {
  PPAMONG_OPERATOR_USERNAMES,
  PPAMONG_OPERATOR_LOGIN_DENIED,
  canAccessPpamongOperator,
  isPpamongOperatorUsername,
} from "../../shared/operatorLoginPolicy";

/** @deprecated shared/operatorLoginPolicy 와 동일 — 하위 호환 */
export const OPERATOR_USERNAMES = PPAMONG_OPERATOR_USERNAMES;

export { PPAMONG_OPERATOR_USERNAMES, PPAMONG_OPERATOR_LOGIN_DENIED, canAccessPpamongOperator };

/** @deprecated canAccessPpamongOperator 사용 */
export const canAccessPpamongManager = canAccessPpamongOperator;

/** @deprecated PPAMONG_OPERATOR_LOGIN_DENIED 사용 */
export const PPAMONG_MANAGER_DENIED_MESSAGE = PPAMONG_OPERATOR_LOGIN_DENIED;

export const PPAMONG_MANAGER_MONGO_FILTER = {
  userType: "매니저" as const,
  username: { $in: [...PPAMONG_OPERATOR_USERNAMES] },
};

export const BADMINTON9_MANAGER_MONGO_FILTER = {
  userType: "매니저" as const,
  username: { $nin: [...PPAMONG_OPERATOR_USERNAMES] },
};

export { isPpamongOperatorUsername };

/** 운영자 계정 출처: 빠몽(op1~5) vs 빠던9 레거시 매니저 */
export function resolveManagerPlatform(username: string): AdminPlatform {
  return isPpamongOperatorUsername(username) ? "ppamong" : "badminton9";
}
