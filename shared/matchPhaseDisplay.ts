import type { LiveScoreboard } from "./apiSportsTypes";
import { formatInningWithHalf, parseInningHalf, type InningHalf } from "./gamePhaseTypes";

/** 운영자·사용자 경기 상태 — "3회 초" 형식 */
export function formatMatchInningPhase(input: {
  matchStatus?: string;
  gameInning?: number | null;
  inningHalf?: string | InningHalf | null;
}): string {
  if (input.matchStatus === "completed") return "경기종료";
  if (input.matchStatus !== "ongoing") return "대기중";

  const inning = input.gameInning ?? 1;
  const half = parseInningHalf(
    typeof input.inningHalf === "string" ? input.inningHalf : input.inningHalf ?? "top",
  );
  return formatInningWithHalf(inning, half);
}

/**
 * API 스코어보드(폴링) 공수 정보 우선, 없으면 운영자 DB gameInning/inningHalf
 */
export function resolveLiveInningPhaseLabel(input: {
  matchStatus?: string;
  gameInning?: number | null;
  inningHalf?: string | InningHalf | null;
  scoreboard?: Pick<LiveScoreboard, "inning" | "inningHalf" | "inningLabel"> | null;
}): string {
  const sb = input.scoreboard;
  if (sb?.inning != null && sb.inningHalf) {
    return formatInningWithHalf(sb.inning, parseInningHalf(sb.inningHalf));
  }
  if (sb?.inningLabel && /회\s*(초|말)/.test(sb.inningLabel)) {
    return sb.inningLabel;
  }
  return formatMatchInningPhase(input);
}
