/**
 * atBatPhase / 가드 단위 검증 — npx tsx scripts/test-at-bat-phase.ts
 */
import {
  atBatPhaseLabel,
  blocksAdvanceUntilResult,
  deriveAtBatPhase,
} from "../shared/atBatPhase";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(deriveAtBatPhase({}) === "idle", "empty → idle");
assert(
  deriveAtBatPhase({
    predictionEnabled: true,
    isPredictionStarted: true,
    isPredictionStopped: false,
  }) === "prediction_open",
  "open",
);
assert(
  deriveAtBatPhase({
    predictionEnabled: false,
    isPredictionStarted: true,
    isPredictionStopped: true,
    isResultSent: false,
  }) === "prediction_closed",
  "closed",
);
assert(
  deriveAtBatPhase({
    isPredictionStarted: true,
    isPredictionStopped: true,
    isResultSent: true,
  }) === "result_confirmed",
  "confirmed",
);

assert(blocksAdvanceUntilResult("prediction_open"), "block open");
assert(blocksAdvanceUntilResult("prediction_closed"), "block closed");
assert(!blocksAdvanceUntilResult("idle"), "allow idle");
assert(!blocksAdvanceUntilResult("result_confirmed"), "allow confirmed");

assert(atBatPhaseLabel("prediction_closed").includes("결과"), "label");

console.log("atBatPhase OK");
