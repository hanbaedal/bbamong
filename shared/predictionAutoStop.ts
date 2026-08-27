import type { AtBatPhase } from "./atBatPhase";

/**
 * 예측 시작 후 8초 자동 중지는 이 가드 하나만 쓴다.
 * predictionEnabled 인데 phase 도출이 어긋난 idle 도 중지한다.
 * 이미 닫힘·확정이면 타이머를 소모만 하고 중복 stop 하지 않는다.
 */
export function shouldExecutePredictionAutoStop(input: {
  predictionEnabled?: boolean | null;
  phase?: AtBatPhase | null;
}): boolean {
  if (!input.predictionEnabled) return false;
  const phase = input.phase ?? "idle";
  if (phase === "prediction_closed" || phase === "result_confirmed") return false;
  return true;
}
