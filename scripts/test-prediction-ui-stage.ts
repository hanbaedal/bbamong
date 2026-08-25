/**
 * 서버 권위 예측 UI 스테이지 매핑 검증
 * 실행: npx tsx scripts/test-prediction-ui-stage.ts
 */
import { deriveAtBatPhase } from "../shared/atBatPhase";
import {
  atBatPhaseToUiStage,
  isPredictionUiStage,
} from "../shared/predictionUiStage";
import { normalizeRoundResultLabel, displayRoundResultLabel } from "../client/src/components/game/gameTypes";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(atBatPhaseToUiStage("idle") === "wait", "idle→wait");
assert(atBatPhaseToUiStage("prediction_open") === "open", "open");
assert(atBatPhaseToUiStage("prediction_closed") === "closed", "closed");
assert(atBatPhaseToUiStage("result_confirmed") === "result", "result");

assert(
  atBatPhaseToUiStage(
    deriveAtBatPhase({
      predictionEnabled: true,
      isPredictionStarted: true,
      isPredictionStopped: false,
      isResultSent: false,
    }),
  ) === "open",
  "derive open",
);
assert(
  atBatPhaseToUiStage(
    deriveAtBatPhase({
      predictionEnabled: false,
      isPredictionStarted: true,
      isPredictionStopped: true,
      isResultSent: false,
    }),
  ) === "closed",
  "derive closed",
);
assert(
  atBatPhaseToUiStage(
    deriveAtBatPhase({
      predictionEnabled: false,
      isPredictionStarted: true,
      isPredictionStopped: true,
      isResultSent: true,
    }),
  ) === "result",
  "derive result",
);

assert(isPredictionUiStage("wait"), "is wait");
assert(!isPredictionUiStage("picking"), "not picking");
assert(normalizeRoundResultLabel("아웃") === "아웃", "normalize");
assert(displayRoundResultLabel("아웃", "삼진아웃") === "삼진아웃", "display prefers live");
assert(displayRoundResultLabel("아웃", null) === "아웃", "display falls back to settle");
assert(displayRoundResultLabel("병살", "") === "아웃", "display 병살");

console.log("OK: prediction ui stage authority");
