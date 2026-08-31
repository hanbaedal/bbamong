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

/** 8초 타이머와 실황 폴링 due 가 같은 중지를 두 번 보내지 않게 */
export const PREDICTION_STOPPED_DEDUP_MS = 2_500;

export function shouldSkipDuplicatePredictionStop(input: {
  inFlight?: boolean;
  lastEmitAt?: number | null;
  now?: number;
  dedupMs?: number;
}): boolean {
  if (input.inFlight) return true;
  const last = input.lastEmitAt;
  if (last == null) return false;
  const now = input.now ?? Date.now();
  const window = input.dedupMs ?? PREDICTION_STOPPED_DEDUP_MS;
  return now - last < window;
}
