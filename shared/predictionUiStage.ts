/**
 * 유저 예측 화면 단계 — 서버가 권위로 방송하고 클라는 그린다.
 * (성공 주루 등 개인 연출은 round_result 이후 클라 로컬)
 */
import type { AtBatPhase } from "./atBatPhase";

export type PredictionUiStage = "wait" | "open" | "closed" | "result";

export const PREDICTION_UI_STAGE_LABELS: Record<PredictionUiStage, string> = {
  wait: "대기",
  open: "예측중",
  closed: "결과대기",
  result: "결과확정",
};

export function atBatPhaseToUiStage(phase: AtBatPhase): PredictionUiStage {
  switch (phase) {
    case "prediction_open":
      return "open";
    case "prediction_closed":
      return "closed";
    case "result_confirmed":
      return "result";
    case "idle":
    default:
      return "wait";
  }
}

/** WS / HTTP 공통 페이로드 */
export type PredictionUiStagePayload = {
  matchId: string;
  stage: PredictionUiStage;
  atBatPhase: AtBatPhase;
  currentRound: number;
  /** stage=result 일 때 라운드 확정 결과 (1루|2루|3루|홈런|아웃) */
  settledResult?: string | null;
  source?: string;
};

export function isPredictionUiStage(value: unknown): value is PredictionUiStage {
  return value === "wait" || value === "open" || value === "closed" || value === "result";
}
