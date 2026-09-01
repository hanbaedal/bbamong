/**
 * 3아웃 카운트는 운영자 결과(outsInHalf)가 권위다.
 * 2아웃+아웃 / 1아웃+병살 / 노아웃+삼살 → 예측은 3아웃으로 끝낸다.
 * 공수교대 **실행·광고**는 운영자 버튼만 (자동 공수교대 없음).
 * 공수교대 **시점**은 실황: 네이버 같은 초/말 3아웃, 또는 이미 다음 초/말(0~2)이면 맞춤.
 * 폴링이 운영자 inningHalf/outsInHalf를 덮지 않는다.
 * 중간 합류: 같은 초/말 실황 3아웃이면 운영자 누적 없이도 공수교대.
 * 공수교대 직후(아웃 0)·광고 중에는 실황 3아웃 잔상으로 다시 부르지 않는다.
 * 실황 아웃이 없으면(위젯 공란) 가짜 0아웃으로 막지 않는다.
 */

export function nullableInningHalf(value: string | null | undefined): "top" | "bottom" | null {
  if (value === "top" || value === "bottom") return value;
  return null;
}

export function liveOutsCount(liveOuts: unknown): number | null {
  if (typeof liveOuts !== "number" || !Number.isFinite(liveOuts)) return null;
  return Math.min(3, Math.max(0, Math.floor(liveOuts)));
}

export function liveOutsFromScoreboard(
  scoreboard:
    | { situation?: { outs?: number | null } | null }
    | null
    | undefined,
): number | null {
  return liveOutsCount(scoreboard?.situation?.outs);
}

export type SwitchHalfLiveInput = {
  liveOuts?: number | null;
  outsInHalf?: number | null;
  liveHalf?: string | null;
  operatorHalf?: string | null;
  liveInning?: number | null;
  operatorInning?: number | null;
  /** 방금 공수교대(광고·쿨다운). 같은 초/말 실황 3아웃 잔상으로 다시 열지 않음 */
  recentlySwitched?: boolean;
};

/** 실황 이닝이 운영자보다 한 박자 뒤 (공수교대 직후 중계 지연). */
export function isLivePhaseBehindOperator(input: {
  liveHalf?: string | null;
  operatorHalf?: string | null;
  liveInning?: number | null;
  operatorInning?: number | null;
}): boolean {
  const live = nullableInningHalf(input.liveHalf);
  const op = nullableInningHalf(input.operatorHalf);
  if (!live || !op) return false;
  const liveInn =
    typeof input.liveInning === "number" && Number.isFinite(input.liveInning)
      ? Math.floor(input.liveInning)
      : null;
  const opInn =
    typeof input.operatorInning === "number" && Number.isFinite(input.operatorInning)
      ? Math.floor(input.operatorInning)
      : null;
  if (liveInn == null || opInn == null) return false;
  if (liveInn < opInn) return true;
  if (liveInn > opInn) return false;
  return live === "top" && op === "bottom";
}

/**
 * 공수교대 직후 운영자 아웃은 0. 실황만 3이면 직전 초/말 잔상이다.
 * 같은 초/말로 보여도 다시 3아웃으로 올리지 않는다.
 */
export function isStaleLiveThreeOutsAfterSwitch(input: SwitchHalfLiveInput): boolean {
  if ((input.outsInHalf ?? 0) !== 0) return false;
  const live = liveOutsCount(input.liveOuts);
  return live != null && live >= 3;
}

/**
 * 실황이 이미 다음 초/말이고 0~2아웃.
 * 위젯은 원아웃인데 운영자 3아웃 잔상으로 「공수교대」를 부르면 안 된다.
 */
export function liveHalfAlreadyStarted(input: SwitchHalfLiveInput): boolean {
  const live = liveOutsCount(input.liveOuts);
  if (live == null || live >= 3) return false;
  const liveHalf = nullableInningHalf(input.liveHalf);
  const operatorHalf = nullableInningHalf(input.operatorHalf);
  return Boolean(liveHalf && operatorHalf && liveHalf !== operatorHalf);
}

/**
 * 같은 초/말(또는 초/말 정보 없음)에서 실황 3아웃.
 * 다른 초/말 3아웃은 직전 이닝 잔상.
 */
export function liveThreeOutsSameHalf(input: SwitchHalfLiveInput): boolean {
  if (liveHalfAlreadyStarted(input)) return false;
  const live = liveOutsCount(input.liveOuts);
  if (live == null || live < 3) return false;
  const liveHalf = nullableInningHalf(input.liveHalf);
  const operatorHalf = nullableInningHalf(input.operatorHalf);
  if (liveHalf && operatorHalf && liveHalf !== operatorHalf) return false;
  return true;
}

/**
 * 「3아웃 — 공수교대」펄스·음성.
 * 같은 초/말 실황 3아웃만. 운영자만 3이고 실황 1·2면 보류 배너만 (여기서 true 하지 않음).
 * 실황 아웃 공란 + 운영자 3은 가짜 0으로 숨기지 않는다.
 */
export function resolveShowThreeOutsHint(input: SwitchHalfLiveInput): boolean {
  if (liveHalfAlreadyStarted(input)) return false;
  if (input.recentlySwitched && (input.outsInHalf ?? 0) < 3) return false;
  if (liveThreeOutsSameHalf(input)) return true;
  if ((input.outsInHalf ?? 0) >= 3 && liveOutsCount(input.liveOuts) == null) return true;
  return false;
}

/**
 * 운영자 3아웃인데 네이버가 같은 초/말에서 아직 0~2아웃이면 공수교대를 보류.
 * 실황 아웃이 없으면(위젯 공란) 보류하지 않는다 — 가짜 0아웃으로 막지 않음.
 */
export function shouldHoldSwitchHalfForLive(input: SwitchHalfLiveInput): boolean {
  if ((input.outsInHalf ?? 0) < 3) return false;
  if (liveHalfAlreadyStarted(input)) return false;
  const live = liveOutsCount(input.liveOuts);
  if (live == null) return false;
  if (live >= 3) return false;
  return true;
}

export function switchHalfHoldMessage(liveOuts?: number | null): string {
  const n = liveOutsCount(liveOuts);
  const liveLabel = n == null ? "실황 아웃 없음" : `실황 ${n}아웃`;
  return `운영자 3아웃 · ${liveLabel}. 중계가 3아웃이면 공수교대하세요. 지금 바꾸려면 한 번 더 누르세요.`;
}

export function switchHalfLiveMovedOnMessage(liveOuts?: number | null): string {
  const n = liveOutsCount(liveOuts);
  const liveLabel = n == null ? "실황이 이미 다음 초/말" : `실황이 이미 다음 초/말 · ${n}아웃`;
  return `${liveLabel}. 공수교대로 맞추고 광고합니다.`;
}

/**
 * 실황이 이미 다음 초/말(또는 다음 이닝) 0~2아웃 — 운영자 초/말을 실황에 맞추는 공수교대.
 * 광고 직후 재호출은 막는다.
 */
export function shouldCatchUpSwitchHalf(input: SwitchHalfLiveInput): boolean {
  if (input.recentlySwitched) return false;
  if (isLivePhaseBehindOperator(input)) return false;
  if (liveHalfAlreadyStarted(input)) return true;
  const live = liveOutsCount(input.liveOuts);
  if (live == null || live >= 3) return false;
  const liveInn =
    typeof input.liveInning === "number" && Number.isFinite(input.liveInning)
      ? Math.floor(input.liveInning)
      : null;
  const opInn =
    typeof input.operatorInning === "number" && Number.isFinite(input.operatorInning)
      ? Math.floor(input.operatorInning)
      : null;
  return Boolean(liveInn != null && opInn != null && liveInn > opInn);
}

export function switchHalfAdBreakMessage(): string {
  return "공수교대가 이미 반영되었습니다. 광고가 끝난 뒤 다음 타석을 진행하세요.";
}

/** 공수교대 제안 — 실황 3아웃, 또는 실황이 이미 다음 초/말(맞춤). */
export function shouldSuggestSwitchHalf(input: SwitchHalfLiveInput): boolean {
  if (shouldCatchUpSwitchHalf(input)) return true;
  if (liveHalfAlreadyStarted(input)) return false;
  if ((input.outsInHalf ?? 0) >= 3) {
    return !shouldHoldSwitchHalfForLive(input);
  }
  if (input.recentlySwitched) return false;
  return liveThreeOutsSameHalf(input);
}

/**
 * 다음 타자·투수교체·예측 시작을 막을지.
 * 실황이 같은 초/말 1·2아웃이면 이닝이 이어지므로 막지 않는다.
 * 막을 때: 실황 3아웃, 실황 공란+운영자 3, 또는 실황이 이미 다음 초/말(맞춤 공수교대).
 */
export function shouldBlockAdvanceForSwitchHalf(input: SwitchHalfLiveInput): boolean {
  return resolveShowThreeOutsHint(input) || shouldCatchUpSwitchHalf(input);
}

/** 결과는 났지만 실황이 같은 초/말 0~2 — 같은 타석 예측을 다시 연다. */
export function shouldContinueSameHalfAfterResult(input: SwitchHalfLiveInput): boolean {
  if (liveHalfAlreadyStarted(input)) return false;
  const live = liveOutsCount(input.liveOuts);
  return live != null && live < 3;
}

/**
 * 공수교대만: 이번 라운드에 예측을 연 적이 없으면 결과 없이 진행.
 * 다음 타자는 쓰지 않는다. 예측을 열었으면 결과는 필수.
 */
export function switchHalfMaySkipUnplayedRound(input: {
  isPredictionStarted?: boolean | null;
}): boolean {
  return !input.isPredictionStarted;
}

/** 공수교대 POST 허용. hold(실황 0~2)는 별도. 다음 초/말은 맞춤 허용. */
export function canAdvanceInningHalf(input: SwitchHalfLiveInput): boolean {
  if (shouldCatchUpSwitchHalf(input)) return true;
  if (liveHalfAlreadyStarted(input)) return false;
  if ((input.outsInHalf ?? 0) >= 3) return true;
  if (input.recentlySwitched) return false;
  return liveThreeOutsSameHalf(input);
}
