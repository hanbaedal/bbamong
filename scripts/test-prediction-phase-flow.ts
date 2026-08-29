/**
 * 예측 단계 화면 전환 — 결과 라벨·phase 유틸 검증
 * 실행: npx tsx scripts/test-prediction-phase-flow.ts
 */
import {
  normalizeRoundResultLabel,
  isOutcomePresentationPhase,
  RESULT_FLASH_MS,
} from "../client/src/components/game/gameTypes";
import { clientPhaseAfterPredictionClosed } from "../shared/predictionUiStage";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(normalizeRoundResultLabel("1루") === "1루", "1루");
assert(normalizeRoundResultLabel("홈런") === "홈런", "홈런");
assert(normalizeRoundResultLabel("아웃") === "아웃", "아웃");
assert(normalizeRoundResultLabel("병살") === "아웃", "병살→아웃");
assert(normalizeRoundResultLabel("삼살") === "아웃", "삼살→아웃");
assert(normalizeRoundResultLabel("포볼") == null, "포볼 제외");
assert(normalizeRoundResultLabel("사구") == null, "사구 제외");

assert(isOutcomePresentationPhase("result_flash"), "result_flash");
assert(isOutcomePresentationPhase("success_running"), "success_running");
assert(!isOutcomePresentationPhase("wait_result"), "wait_result not outcome");
assert(!isOutcomePresentationPhase("picking"), "picking not outcome");
assert(RESULT_FLASH_MS >= 1500 && RESULT_FLASH_MS <= 4000, "flash ms visible");

assert(clientPhaseAfterPredictionClosed(false) === "wait_result", "prediction_closed → wait_result even without pick");
assert(clientPhaseAfterPredictionClosed(true) === "wait_result", "prediction_closed → wait_result with stake");

console.log("OK: prediction phase flow helpers");
