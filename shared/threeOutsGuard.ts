/**
 * 3아웃·공수교대는 운영자가 누른 결과(outsInHalf)가 권위다.
 * 2아웃+아웃 / 1아웃+병살 / 노아웃+삼살 → 공수교대.
 * 네이버 실황은 힌트만 보태고, 실황이 2아웃이어도 운영자 3아웃을 막지 않는다.
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

/** 운영자 누적 아웃이 3이면 공수교대. 실황이 뒤처져도 막지 않는다. */
export function resolveShowThreeOutsHint(input: {
  liveOuts?: number | null;
  outsInHalf?: number | null;
  liveHalf?: string | null;
  operatorHalf?: string | null;
}): boolean {
  return (input.outsInHalf ?? 0) >= 3;
}

/** 공수교대 제안 — 운영자 3아웃, 또는 실황 3아웃(같은 초/말) */
export function shouldSuggestSwitchHalf(input: {
  liveOuts?: number | null;
  outsInHalf?: number | null;
  liveHalf?: string | null;
  operatorHalf?: string | null;
}): boolean {
  if ((input.outsInHalf ?? 0) >= 3) return true;
  const live = liveOutsCount(input.liveOuts);
  if (live == null || live < 3) return false;
  const liveHalf = input.liveHalf?.trim() || "";
  const operatorHalf = input.operatorHalf?.trim() || "";
  if (liveHalf && operatorHalf && liveHalf !== operatorHalf) return false;
  return true;
}
