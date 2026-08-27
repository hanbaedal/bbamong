/**
 * 3아웃·공수교대 멘트는 네이버 실황 아웃만 본다.
 * 초/말 깜빡임·운영자 결과 +1 만으로 3아웃이라고 하면 안 된다.
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

/**
 * 실황 아웃이 있으면 그것만. 실황이 2면 DB outsInHalf가 3이어도 힌트 금지.
 * 운영자가 이미 초/말을 넘겼는데 실황이 직전 이닝 3아웃을 남기면 힌트 금지.
 * 실황이 없을 때만 운영자 누적 아웃(연습·시뮬)을 쓴다.
 */
export function resolveShowThreeOutsHint(input: {
  liveOuts?: number | null;
  outsInHalf?: number | null;
  liveHalf?: string | null;
  operatorHalf?: string | null;
}): boolean {
  const live = liveOutsCount(input.liveOuts);
  if (live != null) {
    if (live < 3) return false;
    const liveHalf = input.liveHalf?.trim() || "";
    const operatorHalf = input.operatorHalf?.trim() || "";
    if (liveHalf && operatorHalf && liveHalf !== operatorHalf) return false;
    return true;
  }
  return (input.outsInHalf ?? 0) >= 3;
}

/** 공수교대 제안 — 실황 3아웃 + 운영자 초/말이 실황과 같을 때만 */
export function shouldSuggestSwitchHalf(input: {
  liveOuts?: number | null;
  liveHalf?: string | null;
  operatorHalf?: string | null;
}): boolean {
  const live = liveOutsCount(input.liveOuts);
  if (live == null || live < 3) return false;
  const liveHalf = input.liveHalf?.trim() || "";
  const operatorHalf = input.operatorHalf?.trim() || "";
  if (liveHalf && operatorHalf && liveHalf !== operatorHalf) return false;
  return true;
}
