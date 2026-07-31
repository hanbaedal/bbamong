import type { GameMatchItem } from "@/components/game/gameMatchUtils";
import { shouldClientPollMatch } from "@/lib/matchPollWindow";

export type GameDayPhase = "loading" | "all_ended" | "pregame" | "live";

/** KST 오늘 경기 목록 → 당일 전체 상태 */
export function resolveGameDayPhase(
  matches: GameMatchItem[],
  loading: boolean,
  nowMs = Date.now(),
): GameDayPhase {
  if (loading) return "loading";

  const today = matches.filter((m) => m.matchStatus !== "cancelled");
  if (today.length === 0) return "all_ended";

  const allEnded = today.every((m) => m.matchStatus === "completed");
  if (allEnded) return "all_ended";

  const hasLive = today.some(
    (m) =>
      m.matchStatus === "ongoing" ||
      shouldClientPollMatch(m.startTime, m.matchStatus, undefined, nowMs),
  );
  if (hasLive) return "live";

  return "pregame";
}

export const GAME_DAY_END_REDIRECT_MS = 3000;

export const LIVE_WAIT_BUBBLE_LINES = ["다음타자", "예측을", "기다리고", "있습니다"] as const;

export const DAY_END_BUBBLE_LINES = ["오늘의 경기", "경기 종료가", "되었습니다"] as const;
