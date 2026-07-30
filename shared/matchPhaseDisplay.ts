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
