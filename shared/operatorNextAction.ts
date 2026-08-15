import type { AtBatPhase } from "./atBatPhase";
import { atBatPhaseLabel } from "./atBatPhase";

export type OperatorNextActionKind =
  | "none"
  | "wait_auto"
  | "confirm_result"
  | "next_batter"
  | "switch_half"
  | "start_prediction"
  | "stop_ad";

export type OperatorNextAction = {
  kind: OperatorNextActionKind;
  label: string;
  /** 결과 확정 시 미리 선택된 값 */
  suggestedResult?: string | null;
};

/**
 * 운영자 화면「지금 할 일 1개」— 자동이 본체일 때 예외만 강조
 */
export function deriveOperatorNextAction(input: {
  liveAutoEnabled?: boolean | null;
  atBatPhase?: AtBatPhase | null;
  suggestedResult?: string | null;
  showThreeOutsHint?: boolean | null;
  needsAdvanceAfterResult?: boolean | null;
  needsResultBeforeAdvance?: boolean | null;
  isAdPlaying?: boolean | null;
  predictionEnabled?: boolean | null;
}): OperatorNextAction {
  if (input.isAdPlaying) {
    return {
      kind: "stop_ad",
      label: "광고 종료 (또는 예측 시작 시 자동 종료)",
    };
  }

  const phase = input.atBatPhase ?? "idle";
  const suggested = input.suggestedResult?.trim() || null;

  if (phase === "prediction_closed" || input.needsResultBeforeAdvance) {
    if (suggested) {
      return {
        kind: "confirm_result",
        label: `결과 「${suggested}」 확정`,
        suggestedResult: suggested,
      };
    }
    return {
      kind: "confirm_result",
      label: "예측 결과 선택·확정",
      suggestedResult: null,
    };
  }

  if (input.showThreeOutsHint || (phase === "result_confirmed" && (input.showThreeOutsHint ?? false))) {
    return { kind: "switch_half", label: "공수교대 (3아웃)" };
  }

  if (phase === "result_confirmed" || input.needsAdvanceAfterResult) {
    if (input.showThreeOutsHint) {
      return { kind: "switch_half", label: "공수교대" };
    }
    return { kind: "next_batter", label: "다음 타자" };
  }

  if (input.liveAutoEnabled !== false) {
    return {
      kind: "wait_auto",
      label: `실황 자동 진행 중 · ${atBatPhaseLabel(phase)}`,
    };
  }

  if (phase === "idle" && !input.predictionEnabled) {
    return { kind: "start_prediction", label: "예측 시작 (수동)" };
  }

  return { kind: "none", label: atBatPhaseLabel(phase) };
}
