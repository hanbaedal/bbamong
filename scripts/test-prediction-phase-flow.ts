/**
 * 예측 단계 화면 전환 — 결과 라벨·phase 유틸 검증
 * 실행: npx tsx scripts/test-prediction-phase-flow.ts
 */
import {
  normalizeRoundResultLabel,
  isOutcomePresentationPhase,
  RESULT_FLASH_MS,
} from "../client/src/components/game/gameTypes";

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
assert(RESULT_FLASH_MS >= 700 && RESULT_FLASH_MS <= 3000, "flash ms");

console.log("OK: prediction phase flow helpers");
