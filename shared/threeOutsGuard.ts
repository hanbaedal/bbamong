/**
 * 3아웃 카운트는 운영자 결과(outsInHalf)가 권위다.
 * 2아웃+아웃 / 1아웃+병살 / 노아웃+삼살 → 예측은 3아웃으로 끝낸다.
 * 공수교대(이닝 넘김·광고)는 네이버가 **같은 초/말에서 3아웃**일 때만 연다.
 * 실황이 이미 다음 초/말(0~2아웃)이면 3아웃 잔상을 지우고 공수교대를 말하지 않는다.
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

/** 운영자 누적 아웃이 3이면 「3아웃」표시. 실황이 이미 다음 초/말이면 숨긴다. */
export function resolveShowThreeOutsHint(input: SwitchHalfLiveInput): boolean {
  if ((input.outsInHalf ?? 0) < 3) return false;
  if (liveHalfAlreadyStarted(input)) return false;
  return true;
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
  return `${liveLabel}. 공수교대하지 말고 다음 타자로 이어가세요.`;
}

export function switchHalfAdBreakMessage(): string {
  return "공수교대가 이미 반영되었습니다. 광고가 끝난 뒤 다음 타석을 진행하세요.";
}

/** 공수교대 제안 — 운영자 3아웃 + 같은 초/말. 교대 직후 0아웃·실황 3 잔상은 제안 없음. */
export function shouldSuggestSwitchHalf(input: SwitchHalfLiveInput): boolean {
  if ((input.outsInHalf ?? 0) < 3) return false;
  if (liveHalfAlreadyStarted(input)) return false;
  return !shouldHoldSwitchHalfForLive(input);
}
