import type { GameMatchItem } from "@/components/game/gameMatchUtils";
import { isMatchSelectableForGame } from "@/components/game/gameMatchUtils";
import { shouldClientPollMatch } from "@/lib/matchPollWindow";
import { isGameFinished, normalizeApiStatusShort } from "@shared/apiSportsStatus";
import { resolveMatchManagementStatusDisplay } from "@shared/matchManagementStatus";

export type GameDayPhase = "loading" | "no_match" | "all_ended" | "pregame" | "live";

export type GameTerminalKind = "ended" | "cancelled" | "postponed";

/** 종료·취소·연기와 구분되는 당일 미등록 안내 */
export type GameDayOverlayKind = GameTerminalKind | "no_match";

/** KST 오늘 경기 목록 → 당일 전체 상태 */
export function resolveGameDayPhase(
  matches: GameMatchItem[],
  loading: boolean,
  nowMs = Date.now(),
): GameDayPhase {
  if (loading) return "loading";
  if (matches.length === 0) return "no_match";

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

export const GAME_NO_MATCH_DISPLAY = {
  mainLabel: "없음",
  mainColor: "#FBBF24",
  subtitle: "오늘 등록·연결된 경기가 없습니다",
} as const;

function classifyMatchTerminal(match: GameMatchItem): GameTerminalKind | "playable" {
  if (match.matchStatus === "ongoing") return "playable";
  if (match.matchStatus === "completed") return "ended";

  if (match.matchStatus === "cancelled") {
    const short = normalizeApiStatusShort(match.liveScoreboard?.statusShort);
    const long = (match.liveScoreboard?.statusLong ?? "").toLowerCase();
    const label = (match.liveScoreboard?.inningLabel ?? "").trim();
    // 실황이 정상 종료(FT)인데 DB가 잠깐 cancelled인 경우 — 종료로 취급
    if (isGameFinished(short) || label === "경기 종료" || label === "경기종료") {
      return "ended";
    }
    if (
      short === "PST" ||
      short === "POST" ||
      short === "POSTPONED" ||
      label === "연기" ||
      /postpon|연기/.test(long)
    ) {
      return "postponed";
    }
    return "cancelled";
  }

  const display = resolveMatchManagementStatusDisplay({
    matchStatus: match.matchStatus,
    statusShort: match.liveScoreboard?.statusShort,
    statusLong: match.liveScoreboard?.statusLong,
    inningLabel: match.liveScoreboard?.inningLabel,
    homeScore: match.liveScoreboard?.homeScore,
    awayScore: match.liveScoreboard?.awayScore,
    inning: match.liveScoreboard?.inning,
    startTime: match.startTime,
  });

  if (/\d+회/.test(display) || display === "경기중" || display === "경기전") {
    return "playable";
  }
  if (display === "중단") return "playable";
  if (display === "취소") return "cancelled";
  if (display === "연기됨" || display === "연기") return "postponed";
  if (display === "경기종료" || display === "종료" || display === "경기 종료") {
    return "ended";
  }
  if (match.matchStatus === "scheduled") return "playable";
  return "playable";
}

function aggregateTerminalKind(kinds: GameTerminalKind[]): GameTerminalKind {
  if (kinds.length === 0) return "ended";
  if (kinds.every((k) => k === "postponed")) return "postponed";
  if (kinds.every((k) => k === "cancelled")) return "cancelled";
  if (kinds.every((k) => k === "ended")) return "ended";
  // 제1경기 종료 + 다른 슬롯 취소 혼재 시 「취소」 대신 「종료」 우선
  if (kinds.includes("ended")) return "ended";
  if (kinds.includes("postponed")) return "postponed";
  if (kinds.includes("cancelled")) return "cancelled";
  return "ended";
}

/** 당일 경기 안내 오버레이 — 미등록·종료·취소·연기 (참여 가능 경기 없을 때) */
export function shouldSuppressEmptyMatchOverlay(args: {
  matchCount: number;
  selectedMatchId: string | null;
  matchesError?: boolean;
}): boolean {
  return args.matchCount === 0 && Boolean(args.selectedMatchId || args.matchesError);
}

export function resolveGameDayOverlayKind(
  matches: GameMatchItem[],
  loading: boolean,
  nowMs = Date.now(),
): GameDayOverlayKind | null {
  if (loading) return null;
  if (matches.length === 0) return "no_match";

  const dayPhase = resolveGameDayPhase(matches, false, nowMs);
  if (dayPhase === "live") return null;
  if (matches.some((m) => isMatchSelectableForGame(m, nowMs))) return null;

  if (dayPhase === "pregame") {
    const hasUpcoming = matches.some(
      (m) => m.matchStatus === "scheduled" && classifyMatchTerminal(m) === "playable",
    );
    if (hasUpcoming) return null;
  }

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

/** @deprecated resolveGameDayOverlayKind 사용 */
export function resolveGameTerminalKind(
  matches: GameMatchItem[],
  loading: boolean,
  nowMs = Date.now(),
): GameTerminalKind | null {
  const kind = resolveGameDayOverlayKind(matches, loading, nowMs);
  return kind === "no_match" || kind == null ? null : kind;
}
