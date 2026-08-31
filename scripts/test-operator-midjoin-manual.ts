/**
 * 운영자 중간 합류·재연결 문구가 매뉴얼 소스에 있는지.
 * 실행: npx tsx scripts/test-operator-midjoin-manual.ts
 */
import { MANAGER_GUIDE_STEPS } from "../client/src/managerPages/ManagerGuideModal";
import { OPERATOR_RULES, OPERATOR_USER_STEPS } from "../shared/systemManualsDetail";
import { OPERATOR_EXCEPTION_STEPS } from "../shared/systemOpsHandbook";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(
  OPERATOR_USER_STEPS.some((s) => s.title.includes("중간 합류") && s.body.includes("켜진 다음 버튼")),
  "operator step: mid-join next button",
);
assert(
  OPERATOR_USER_STEPS.some((s) => s.body.includes("재로그인하지 말고")),
  "operator step: reconnect not re-login",
);
assert(
  OPERATOR_RULES.some((r) => r.includes("화면에 켜진 다음 버튼만")),
  "operator rule: next button only",
);
assert(
  OPERATOR_RULES.some((r) => r.includes("재로그인하지 말고 재연결")),
  "operator rule: reconnect",
);
assert(
  OPERATOR_EXCEPTION_STEPS.some((r) => r.includes("중간 합류") && r.includes("켜진 다음 버튼")),
  "exception: mid-join",
);
assert(
  OPERATOR_EXCEPTION_STEPS.some((r) => r.includes("재로그인보다 재연결")),
  "exception: reconnect first",
);
assert(
  MANAGER_GUIDE_STEPS.some((s) => s.bullets.some((b) => b.includes("재로그인하지 말고 재연결"))),
  "guide: reconnect",
);
assert(
  MANAGER_GUIDE_STEPS.some((s) => s.bullets.some((b) => b.includes("켜진 다음 버튼만"))),
  "guide: next button",
);

console.log("operator mid-join manual OK");
