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

/** 예측 창이 닫힌 뒤 클라 화면 — 제출·미선택 모두 결과대기(미선택은 포인트·주루 없음) */
export type ClientClosedScreenPhase = "wait_result" | "wait_start";

export function hasClientPredictionStake(input: {
  activeBet?: unknown;
  betSnapshot?: unknown;
  submitting?: boolean;
}): boolean {
  return Boolean(input.activeBet || input.betSnapshot || input.submitting);
}

/**
 * 예측 중지·결과 확정 시 화면.
 * 선택을 못 해도 제출자와 같이 wait_result → 결과 큰 글씨 → 다음 타석.
 */
export function clientPhaseAfterPredictionClosed(_hasStake?: boolean): ClientClosedScreenPhase {
  return "wait_result";
}

/**
 * /check 에 예측이 없을 때 결과대기를 유지할지.
 * 같은 라운드 결과가 오기 전에는 미선택도 유지한다. 라운드가 바뀌었거나 이미 본 결과만 푼다.
 */
export function shouldKeepWaitResultWithoutCheck(input: {
  hasLocalBet: boolean;
  submitting: boolean;
  awaitRound?: number | null;
  checkRound?: number | null;
  resultAlreadyShown?: boolean;
}): boolean {
  if (input.resultAlreadyShown) return false;
  const roundChanged =
    typeof input.awaitRound === "number" &&
    typeof input.checkRound === "number" &&
    input.awaitRound !== input.checkRound;
  if (roundChanged) return false;
  if (input.hasLocalBet || input.submitting) return true;
  return typeof input.awaitRound === "number";
}

/**
 * 확정 결과 큰 글씨 — 이미 본 라운드·연출 중이면 다시 그리지 않는다.
 * WS / HTTP /check / 실황 문구가 같은 결과를 재생하지 않게 한곳만 쓴다.
 */
export function shouldShowSettledResultFlash(input: {
  alreadyAcked: boolean;
  presenting: boolean;
}): boolean {
  if (input.presenting) return false;
  return !input.alreadyAcked;
}
