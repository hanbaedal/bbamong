/**
 * 타석(라운드) 진행 단계 — 운영자 수동·실황 자동이 같은 순서만 따른다.
 * 대기 → 예측열림 → 예측닫힘 → 결과확정 → (다음타자|공수교대)
 */
export type AtBatPhase =
  | "idle"
  | "prediction_open"
  | "prediction_closed"
  | "result_confirmed";

export const AT_BAT_PHASE_LABELS: Record<AtBatPhase, string> = {
  idle: "대기",
  prediction_open: "예측열림",
  prediction_closed: "예측닫힘(결과대기)",
  result_confirmed: "결과확정",
};

export function atBatPhaseLabel(phase: AtBatPhase | null | undefined): string {
  if (!phase) return AT_BAT_PHASE_LABELS.idle;
  return AT_BAT_PHASE_LABELS[phase] ?? AT_BAT_PHASE_LABELS.idle;
}

/** RoundStatistics + predictionEnabled 로부터 단계 도출 */
export function deriveAtBatPhase(input: {
  predictionEnabled?: boolean | null;
  isPredictionStarted?: boolean | null;
  isPredictionStopped?: boolean | null;
  isResultSent?: boolean | null;
}): AtBatPhase {
  if (input.isResultSent) return "result_confirmed";
  if (input.predictionEnabled && input.isPredictionStarted && !input.isPredictionStopped) {
    return "prediction_open";
  }
  if (input.isPredictionStarted && input.isPredictionStopped && !input.isResultSent) {
    return "prediction_closed";
  }
  return "idle";
}

/** 결과 확정 전 자동 진행(다음타자·공수·광고) 금지 */
export function blocksAdvanceUntilResult(phase: AtBatPhase): boolean {
  return phase === "prediction_open" || phase === "prediction_closed";
}
