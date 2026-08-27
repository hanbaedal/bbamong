/**
 * 3아웃 카운트는 운영자 결과(outsInHalf)가 권위다.
 * 2아웃+아웃 / 1아웃+병살 / 노아웃+삼살 → 예측은 3아웃으로 끝낸다.
 * 공수교대(이닝 넘김·광고)는 네이버가 같은 초/말에서 3아웃이거나
 * 이미 초/말이 바뀌었을 때만 바로 연다. 실황이 비면(타석 없음) 막지 않는다.
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

/** 운영자 누적 아웃이 3이면 「3아웃」표시. 다음 타자·예측 시작은 막는다. */
export function resolveShowThreeOutsHint(input: {
  liveOuts?: number | null;
  outsInHalf?: number | null;
  liveHalf?: string | null;
  operatorHalf?: string | null;
}): boolean {
  return (input.outsInHalf ?? 0) >= 3;
}

export type SwitchHalfLiveInput = {
  liveOuts?: number | null;
  outsInHalf?: number | null;
  liveHalf?: string | null;
  operatorHalf?: string | null;
};

/**
 * 운영자 3아웃인데 네이버가 같은 초/말에서 아직 0~2아웃이면 공수교대를 보류.
 * 실황 아웃이 없으면(위젯 공란) 보류하지 않는다 — 가짜 0아웃으로 막지 않음.
 */
export function shouldHoldSwitchHalfForLive(input: SwitchHalfLiveInput): boolean {
  if ((input.outsInHalf ?? 0) < 3) return false;
  const live = liveOutsCount(input.liveOuts);
  if (live == null) return false;
  if (live >= 3) return false;
  const liveHalf = nullableInningHalf(input.liveHalf);
  const operatorHalf = nullableInningHalf(input.operatorHalf);
  if (liveHalf && operatorHalf && liveHalf !== operatorHalf) return false;
  return true;
}

export function switchHalfHoldMessage(liveOuts?: number | null): string {
  const n = liveOutsCount(liveOuts);
  const liveLabel = n == null ? "실황 아웃 없음" : `실황 ${n}아웃`;
  return `운영자 3아웃 · ${liveLabel}. 중계가 3아웃이면 공수교대하세요. 지금 바꾸려면 한 번 더 누르세요.`;
}

/** 공수교대 제안 — 운영자 3아웃(실황 보류 제외) 또는 실황 3아웃(같은 초/말) */
export function shouldSuggestSwitchHalf(input: SwitchHalfLiveInput): boolean {
  if ((input.outsInHalf ?? 0) >= 3) {
    return !shouldHoldSwitchHalfForLive(input);
  }
  const live = liveOutsCount(input.liveOuts);
  if (live == null || live < 3) return false;
  const liveHalf = input.liveHalf?.trim() || "";
  const operatorHalf = input.operatorHalf?.trim() || "";
  if (liveHalf && operatorHalf && liveHalf !== operatorHalf) return false;
  return true;
}
