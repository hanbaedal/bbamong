import type { AtBatPhase } from "./atBatPhase";

export type OperatorNextActionKind =
  | "none"
  | "wait_auto"
  | "confirm_result"
  | "next_batter"
  | "switch_half"
  | "wait_live_three_outs"
  | "start_prediction"
  | "stop_ad";

export type OperatorNextAction = {
  kind: OperatorNextActionKind;
  label: string;
  /** 결과 확정 시 미리 선택된 값 */
  suggestedResult?: string | null;
};

/**
 * 운영자 화면「지금 할 일 1개」
 * 진행(예측 시작·결과·다음타자·공수·투수·대타)은 운영자 버튼.
 * 예측 중지만 시작 8초 후 자동.
 */
export function deriveOperatorNextAction(input: {
  /** @deprecated 진행은 수동 — 무시됨 */
  liveAutoEnabled?: boolean | null;
  atBatPhase?: AtBatPhase | null;
  suggestedResult?: string | null;
  showThreeOutsHint?: boolean | null;
  holdSwitchForLive?: boolean | null;
  liveOuts?: number | null;
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

  if (phase === "prediction_open" || input.predictionEnabled) {
    return {
      kind: "wait_auto",
      label: "예측 중 · 8초 후 자동 중지",
    };
  }

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

  const threeOuts = Boolean(input.showThreeOutsHint);
  if (threeOuts && input.holdSwitchForLive) {
    const n = typeof input.liveOuts === "number" ? input.liveOuts : null;
    return {
      kind: "wait_live_three_outs",
      label: n == null ? "실황 3아웃 대기" : `실황 ${n}아웃 · 3아웃되면 공수교대`,
    };
  }

  if (threeOuts || (phase === "result_confirmed" && threeOuts)) {
    return { kind: "switch_half", label: "공수교대" };
  }

  if (phase === "result_confirmed" || input.needsAdvanceAfterResult) {
    if (threeOuts) {
      return { kind: "switch_half", label: "공수교대" };
    }
    return { kind: "next_batter", label: "다음 타자" };
  }

  return {
    kind: "start_prediction",
    label: "예측 시작",
  };
}
