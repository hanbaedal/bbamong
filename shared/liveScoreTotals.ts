import type { InningRunsMap } from "./apiSportsTypes";

/** 이닝별 득점 합 — null/비숫자는 무시 */
export function sumInningRuns(map?: InningRunsMap | null): number {
  if (!map) return 0;
  let total = 0;
  for (const value of Object.values(map)) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      total += value;
    }
  }
  return total;
}

/**
 * 다음 `run` 필드가 이닝표보다 낮으면(지연·누락) 이닝 합을 쓴다.
 * 이닝 합이 더 작으면 공식 run을 유지(이닝 CSV 미완 구간).
 */
export function reconcileTeamRuns(
  reportedRun: number,
  innings?: InningRunsMap | null,
): number {
  const reported = Number.isFinite(reportedRun) && reportedRun >= 0 ? reportedRun : 0;
  const fromInnings = sumInningRuns(innings);
  return Math.max(reported, fromInnings);
}
