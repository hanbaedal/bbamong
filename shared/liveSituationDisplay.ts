import type { LiveScoreSituation } from "./apiSportsTypes";

/** pitchLabel 예: "3구 볼" → 3 */
export function extractPitchNumFromLabel(label?: string | null): number | null {
  const m = (label ?? "").trim().match(/^(\d+)구/);
  if (!m) return null;
  const n = Number.parseInt(m[1]!, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * 네이버 currentGameState 가 한 박자 늦을 때 pitchLabel·ptsOptions 기준으로 B-S를 맞춘다.
 * 같은 스냅샷에서 위젯·스트라이크존이 동시에 갱신되도록 한다.
 */
export function coalesceLiveSituation(
  next: LiveScoreSituation,
  prev: LiveScoreSituation | null | undefined,
): LiveScoreSituation {
  if (!prev) return next;

  const nextNum = extractPitchNumFromLabel(next.pitchLabel);
  const prevNum = extractPitchNumFromLabel(prev.pitchLabel);
  const pitchAdvanced =
    nextNum != null && prevNum != null
      ? nextNum > prevNum
      : (next.pitchLocations?.length ?? 0) > (prev.pitchLocations?.length ?? 0);

  if (!pitchAdvanced) return next;

  const last = next.pitchLocations?.[next.pitchLocations.length - 1];
  if (!last?.result) return next;

  if (next.balls !== prev.balls || next.strikes !== prev.strikes) return next;

  const key = last.result.trim().toUpperCase();
  let balls = next.balls;
  let strikes = next.strikes;

  if (key === "B") {
    balls = Math.min(3, balls + 1);
  } else if (key === "T" || key === "C" || key === "S") {
    strikes = Math.min(2, strikes + 1);
  } else if (key === "F" && strikes < 2) {
    strikes = Math.min(2, strikes + 1);
  } else {
    return next;
  }

  return { ...next, balls, strikes };
}
