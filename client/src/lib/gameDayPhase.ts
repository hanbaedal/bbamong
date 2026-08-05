import type { GameMatchItem } from "@/components/game/gameMatchUtils";
import { isMatchSelectableForGame } from "@/components/game/gameMatchUtils";
import { shouldClientPollMatch } from "@/lib/matchPollWindow";
import { isConfirmedPostponedMatch } from "@shared/apiSportsStatus";
import { resolveMatchManagementStatusDisplay } from "@shared/matchManagementStatus";

export type GameDayPhase = "loading" | "all_ended" | "pregame" | "live";

export type GameTerminalKind = "ended" | "cancelled" | "postponed";

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

export const GAME_TERMINAL_DISPLAY: Record<
  GameTerminalKind,
  { mainLabel: string; mainColor: string; subtitle: string }
> = {
  ended: { mainLabel: "종료", mainColor: "#D4D4D4", subtitle: "되었습니다" },
  cancelled: { mainLabel: "취소", mainColor: "#E11937", subtitle: "되었습니다" },
  postponed: { mainLabel: "연기", mainColor: "#C084FC", subtitle: "되었습니다" },
};

function classifyMatchTerminal(match: GameMatchItem): GameTerminalKind | "playable" {
  if (match.matchStatus === "ongoing") return "playable";

  const display = resolveMatchManagementStatusDisplay({
    matchStatus: match.matchStatus,
    statusShort: match.liveScoreboard?.statusShort,
    statusLong: match.liveScoreboard?.statusLong,
    inningLabel: match.liveScoreboard?.inningLabel,
  });

  if (/\d+회/.test(display) || display === "경기중" || display === "경기전") {
    return "playable";
  }
  if (display === "취소" || display === "중단") return "cancelled";
  if (display === "연기됨" || display === "연기") return "postponed";
  if (display === "경기종료" || display === "종료" || display === "경기 종료") {
    return "ended";
  }
  if (match.matchStatus === "completed") return "ended";
  if (match.matchStatus === "cancelled") {
    if (
      isConfirmedPostponedMatch({
        matchStatus: match.matchStatus,
        statusShort: match.liveScoreboard?.statusShort,
        statusLong: match.liveScoreboard?.statusLong,
        inningLabel: match.liveScoreboard?.inningLabel,
      })
    ) {
      return "postponed";
    }
    return "cancelled";
  }
  if (match.matchStatus === "scheduled") return "playable";
  return "playable";
}

function aggregateTerminalKind(kinds: GameTerminalKind[]): GameTerminalKind {
  if (kinds.length === 0) return "ended";
  if (kinds.every((k) => k === "postponed")) return "postponed";
  if (kinds.every((k) => k === "cancelled")) return "cancelled";
  if (kinds.every((k) => k === "ended")) return "ended";
  if (kinds.includes("postponed")) return "postponed";
  if (kinds.includes("cancelled")) return "cancelled";
  return "ended";
}

/** 종료·취소·연기 안내 오버레이 — 참여 가능 경기 없을 때만 */
export function resolveGameTerminalKind(
  matches: GameMatchItem[],
  loading: boolean,
  nowMs = Date.now(),
): GameTerminalKind | null {
  if (loading) return null;

  const dayPhase = resolveGameDayPhase(matches, false, nowMs);
  if (dayPhase === "live") return null;
  if (matches.some((m) => isMatchSelectableForGame(m, nowMs))) return null;

  if (dayPhase === "pregame") {
    const hasUpcoming = matches.some(
      (m) => m.matchStatus === "scheduled" && classifyMatchTerminal(m) === "playable",
    );
    if (hasUpcoming) return null;
  }

  if (matches.length === 0) return "ended";

  const terminalKinds = matches
    .map(classifyMatchTerminal)
    .filter((k): k is GameTerminalKind => k !== "playable");

  if (terminalKinds.length === 0) {
    return dayPhase === "all_ended" ? "ended" : null;
  }

  if (dayPhase === "all_ended" || terminalKinds.length === matches.length) {
    return aggregateTerminalKind(terminalKinds);
  }

  return null;
}
