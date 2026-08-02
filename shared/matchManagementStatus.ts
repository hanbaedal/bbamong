import {
  isGameFinished,
  isGameLiveStatus,
  isGamePostponedOrCancelled,
  isConfirmedPostponedMatch,
  normalizeApiStatusShort,
} from "./apiSportsStatus";
import { resolveOperatorMatchPhase } from "./operatorMatchStatus";

/** 진행 이닝 정보가 있으면 true (1회, 3회초 등) */
export function hasLiveInningProgress(input: {
  inning?: number | null;
  inningLabel?: string | null;
}): boolean {
  if (input.inning != null && input.inning > 0) return true;
  const label = input.inningLabel ?? "";
  return /\d+회/.test(label) && !/종료|연기|취소/.test(label);
}

/** DB/API 종료·연기인데 이닝 진행 중 — 상태 오분류 (실제로는 경기 중) */
export function isMisclassifiedTerminalStatus(input: {
  matchStatus?: string | null;
  statusShort?: string | null;
  inning?: number | null;
  inningLabel?: string | null;
}): boolean {
  if (!hasLiveInningProgress(input)) return false;

  const label = input.inningLabel ?? "";
  if (/종료/.test(label)) return false;

  if (input.matchStatus === "completed") {
    return !isGameFinished(input.statusShort);
  }
  if (input.matchStatus === "cancelled") {
    return !isGamePostponedOrCancelled(input.statusShort);
  }

  if (isGameFinished(input.statusShort) || isGamePostponedOrCancelled(input.statusShort)) {
    return true;
  }
  return false;
}

/** FT/completed인데 0:0·이닝 없음 — 종료 오인 (스케줄 stale·DB 오류) */
export function isStaleFinishedScoreboard(input: {
  matchStatus?: string | null;
  statusShort?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  inning?: number | null;
  inningLabel?: string | null;
}): boolean {
  const total = (input.homeScore ?? 0) + (input.awayScore ?? 0);
  if (total > 0) return false;
  if (input.inning != null) return false;

  const label = input.inningLabel ?? "";
  if (/\d+회/.test(label)) return false;

  if (input.matchStatus === "completed") return true;
  if (isGameFinished(input.statusShort)) return true;
  if (input.matchStatus === "ongoing" || isGameLiveStatus(input.statusShort)) return true;

  return false;
}

/** POST/PST + 0:0·이닝 없음 — 연기 오인 (스케줄 stale, 동시간대 타 경기 진행) */
export function isStalePostponedScoreboard(input: {
  matchStatus?: string | null;
  statusShort?: string | null;
  statusLong?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  inning?: number | null;
  inningLabel?: string | null;
}): boolean {
  if (isConfirmedPostponedMatch(input)) return false;

  const short = normalizeApiStatusShort(input.statusShort);
  const looksPostponed =
    input.matchStatus === "cancelled" ||
    isGamePostponedOrCancelled(short) ||
    input.inningLabel === "연기";

  if (!looksPostponed) return false;

  const total = (input.homeScore ?? 0) + (input.awayScore ?? 0);
  if (total > 0) return false;
  if (input.inning != null) return false;
  if (/\d+회/.test(input.inningLabel ?? "")) return false;

  const long = (input.statusLong ?? "").toLowerCase();
  // POST 단독은 api-sports 스케줄 stale 빈번 — long 없으면 연기 오인
  if (short === "POST" && !/postponed|postponement|연기/.test(long)) {
    return true;
  }

  return false;
}

function scoreboardStaleInput(input: {
  matchStatus?: string | null;
  statusShort?: string | null;
  statusLong?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  inning?: number | null;
  inningLabel?: string | null;
}) {
  return input;
}

/** 경기관리·운영자 리스트 공통 상태 라벨 (진행 중은 N회 표시 유지) */
export function resolveMatchManagementStatusDisplay(input: {
  matchStatus?: string | null;
  statusShort?: string | null;
  statusLong?: string | null;
  inningLabel?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  inning?: number | null;
}): string {
  const inningLabel = input.inningLabel?.trim();

  if (inningLabel && /\d+회/.test(inningLabel) && !/종료|연기|취소/.test(inningLabel)) {
    return inningLabel;
  }

  if (
    isMisclassifiedTerminalStatus(
      scoreboardStaleInput({
        matchStatus: input.matchStatus,
        statusShort: input.statusShort,
        inning: input.inning,
        inningLabel,
      }),
    )
  ) {
    return inningLabel && /\d+회/.test(inningLabel) ? inningLabel : "경기중";
  }

  if (
    isStaleFinishedScoreboard(
      scoreboardStaleInput({
        matchStatus: input.matchStatus,
        statusShort: input.statusShort,
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        inning: input.inning,
        inningLabel,
      }),
    )
  ) {
    return input.matchStatus === "ongoing" ? "경기중" : "경기전";
  }

  if (
    isStalePostponedScoreboard(
      scoreboardStaleInput({
        matchStatus: input.matchStatus,
        statusShort: input.statusShort,
        statusLong: input.statusLong,
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        inning: input.inning,
        inningLabel,
      }),
    )
  ) {
    return input.matchStatus === "ongoing" ? "경기중" : "경기전";
  }

  if (inningLabel === "경기 종료") {
    return "경기종료";
  }

  const phase = resolveOperatorMatchPhase({
    matchStatus: input.matchStatus,
    statusShort: input.statusShort,
    statusLong: input.statusLong,
  });

  if (phase === "경기중" && inningLabel && !/종료|연기|취소/.test(inningLabel)) {
    return inningLabel;
  }

  return phase ?? "경기전";
}

export function matchManagementStatusBadgeClass(display: string): string {
  if (display === "경기중" || display === "진행" || /\d+회/.test(display)) {
    return "bg-green-50 text-green-700";
  }
  if (display === "경기종료" || display === "종료" || display === "경기 종료") {
    return "bg-gray-100 text-gray-600";
  }
  if (display === "연기됨" || display === "연기" || display === "취소" || display === "중단") {
    return "bg-purple-50 text-purple-700";
  }
  return "bg-amber-50 text-amber-700";
}
