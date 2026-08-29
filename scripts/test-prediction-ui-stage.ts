/**
 * 서버 권위 예측 UI 스테이지 매핑 검증
 * 실행: npx tsx scripts/test-prediction-ui-stage.ts
 */
import { deriveAtBatPhase } from "../shared/atBatPhase";
import {
  atBatPhaseToUiStage,
  isPredictionUiStage,
  shouldShowSettledResultFlash,
} from "../shared/predictionUiStage";
import { normalizeRoundResultLabel, displayRoundResultLabel } from "../client/src/components/game/gameTypes";
import { roundResultAckToken } from "../client/src/lib/predictionResultAck";

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
assert(roundResultAckToken(3, "아웃") === "3:아웃", "round+result token");
assert(roundResultAckToken(3, "병살") === "3:아웃", "병살 token is 아웃");
assert(roundResultAckToken(3, "삼진아웃") == null, "unnormalized live text is not a token");
assert(roundResultAckToken(3, "아웃") === roundResultAckToken(3, "아웃"), "same result same token");
assert(roundResultAckToken(4, "아웃") !== roundResultAckToken(3, "아웃"), "new round is new token");
assert(shouldShowSettledResultFlash({ alreadyAcked: false, presenting: false }) === true, "first flash");
assert(shouldShowSettledResultFlash({ alreadyAcked: true, presenting: false }) === false, "acked no replay");
assert(shouldShowSettledResultFlash({ alreadyAcked: false, presenting: true }) === false, "presenting no replay");
assert(shouldShowSettledResultFlash({ alreadyAcked: true, presenting: true }) === false, "both block replay");

console.log("OK: prediction ui stage authority");
