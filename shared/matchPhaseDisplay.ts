import type { InningRunsMap, LiveScoreboard } from "./apiSportsTypes";
import { formatInningWithHalf, parseInningHalf, type InningHalf } from "./gamePhaseTypes";

/** 이닝별 득점 맵에서 진행 중인(또는 마지막) 회 추정 — 숫자 득점(0 포함)이 있는 최대 회 */
export function inferCurrentInningFromRuns(
  awayInnings?: InningRunsMap | null,
  homeInnings?: InningRunsMap | null,
): number | null {
  let max = 0;
  for (const map of [awayInnings, homeInnings]) {
    if (!map) continue;
    for (const [key, value] of Object.entries(map)) {
      const n = Number.parseInt(key, 10);
      if (!Number.isFinite(n) || n <= 0) continue;
      if (typeof value === "number") {
        max = Math.max(max, n);
      }
    }
  }
  return max > 0 ? max : null;
}

/** 현재 회 기준 초/말 추정 — 홈 득점 칸이 있으면 말, 원정만 있으면 초 */
export function inferInningHalfFromRuns(
  inning: number,
  awayInnings?: InningRunsMap | null,
  homeInnings?: InningRunsMap | null,
): InningHalf | null {
  const key = String(inning);
  const awayHas = typeof awayInnings?.[key] === "number";
  const homeHas = typeof homeInnings?.[key] === "number";
  if (homeHas) return "bottom";
  if (awayHas) return "top";
  return null;
}

/**
 * 스코어보드·운영자 DB를 합쳐 실제 표시용 회/초말 결정.
 * 운영자 gameInning/inningHalf 를 최우선 (TV·현장 기준). 없을 때만 API status·이닝표.
 */
export function resolveScoreboardInningPhase(input: {
  gameInning?: number | null;
  inningHalf?: string | InningHalf | null;
  scoreboard?: Pick<
    LiveScoreboard,
    "inning" | "inningHalf" | "inningLabel" | "awayInnings" | "homeInnings"
  > | null;
}): { inning: number; half: InningHalf } | null {
  const sb = input.scoreboard;
  const fromOperator = input.gameInning ?? null;
  const halfFromOperator = input.inningHalf
    ? parseInningHalf(typeof input.inningHalf === "string" ? input.inningHalf : input.inningHalf)
    : null;

  if (fromOperator != null && fromOperator > 0 && halfFromOperator) {
    return { inning: fromOperator, half: halfFromOperator };
  }

  const inferred = inferCurrentInningFromRuns(sb?.awayInnings, sb?.homeInnings);
  const fromStatus = sb?.inning ?? null;

  let inning: number | null = null;
  if (inferred != null && fromStatus != null) {
    inning = Math.max(inferred, fromStatus);
  } else {
    inning = inferred ?? fromStatus ?? fromOperator;
  }
  if (inning == null) return null;

  const halfFromStatus = sb?.inningHalf ? parseInningHalf(sb.inningHalf) : null;
  const halfFromRuns = inferInningHalfFromRuns(inning, sb?.awayInnings, sb?.homeInnings);
  const half = halfFromOperator ?? halfFromStatus ?? halfFromRuns;
  if (!half) return null;

  return { inning, half };
}

/** 운영자·사용자 경기 상태 — "3회 초" 형식 */
export function formatMatchInningPhase(input: {
  matchStatus?: string;
  gameInning?: number | null;
  inningHalf?: string | InningHalf | null;
}): string {
  if (input.matchStatus === "completed") return "경기종료";
  if (input.matchStatus === "cancelled") return "연기됨";
  if (input.matchStatus !== "ongoing") return "경기전";

  const inning = input.gameInning ?? 1;
  const half = parseInningHalf(
    typeof input.inningHalf === "string" ? input.inningHalf : input.inningHalf ?? "top",
  );
  return formatInningWithHalf(inning, half);
}

/**
 * 운영자 DB gameInning/inningHalf 우선, 없으면 API 스코어보드(이닝 점수·status)
 */
export function resolveLiveInningPhaseLabel(input: {
  matchStatus?: string;
  gameInning?: number | null;
  inningHalf?: string | InningHalf | null;
  scoreboard?: Pick<
    LiveScoreboard,
    "inning" | "inningHalf" | "inningLabel" | "awayInnings" | "homeInnings"
  > | null;
}): string {
  if (input.matchStatus === "completed") return "경기종료";
  if (input.matchStatus === "cancelled") return "연기됨";
  if (input.matchStatus && input.matchStatus !== "ongoing") return "경기전";

  const resolved = resolveScoreboardInningPhase(input);
  if (resolved) {
    return formatInningWithHalf(resolved.inning, resolved.half);
  }

  const sb = input.scoreboard;
  if (sb?.inningLabel && /회\s*(초|말)/.test(sb.inningLabel)) {
    return sb.inningLabel;
  }
  if (input.matchStatus === "ongoing" || input.matchStatus == null) {
    return formatMatchInningPhase({
      matchStatus: input.matchStatus ?? "ongoing",
      gameInning: input.gameInning,
      inningHalf: input.inningHalf,
    });
  }
  return formatMatchInningPhase(input);
}
