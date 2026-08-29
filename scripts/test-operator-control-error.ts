/**
 * 다음타자 등 운영자 진행 오류는 500이 아니라 400
 * 실행: npx tsx scripts/test-operator-control-error.ts
 */
import {
  isOperatorControlFlowError,
  operatorControlErrorStatus,
} from "../shared/operatorControlError";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isOperatorControlFlowError("예측을 먼저 중지해 주세요."), "open prediction is 400");
assert(
  isOperatorControlFlowError(
    "라운드 3의 예측이 아직 중지되지 않았습니다. 먼저 예측을 중지해주세요.",
  ),
  "nextRound open prediction is 400",
);
assert(isOperatorControlFlowError("먼저 예측 결과를 전송해 주세요."), "missing result is 400");
assert(
  isOperatorControlFlowError("먼저 예측을 시작하고 결과를 전송해 주세요."),
  "missing start is 400",
);
assert(
  isOperatorControlFlowError("운영자 3아웃 · 실황 2아웃. 중계가 3아웃이면 공수교대하세요."),
  "hold message is 400",
);
assert(isOperatorControlFlowError("결과가 전송되었습니다. 다음 타자를 눌러주세요."), "result sent is 400");
assert(!isOperatorControlFlowError("Transaction numbers are only allowed"), "mongo stays 500");
assert(!isOperatorControlFlowError("ECONNRESET"), "network stays 500");

const flow = operatorControlErrorStatus(new Error("예측을 먼저 중지해 주세요."));
assert(flow.status === 400, "status 400");
const fatal = operatorControlErrorStatus(new Error("ECONNRESET"));
assert(fatal.status === 500, "status 500");

console.log("OK: operator control flow errors are 400");
