import type { LiveScoreboard } from "@shared/apiSportsTypes";
import { formatInningWithHalf, type InningHalf } from "@shared/gamePhaseTypes";

/**
 * 수동 잠금(controlMode=manual)일 때만 API가 점수·이닝 표를 덮어쓰지 않음.
 * auto면 경기 중에도 API 스코어를 반영한다. 운영자 보정 시에만 manual.
 * API 종료(FT 등) + auto 이면 최종 스코어 반영.
 * manual 이면 종료 시에도 운영자/관리자 보정 점수 유지.
 */
export function shouldPreserveLiveScoreFields(
  match: { controlMode?: string | null; matchStatus?: string | null },
  _apiStatusShort?: string | null,
): boolean {
  return match.controlMode === "manual";
}

/** 기존 보드의 점수·이닝 표를 유지하고, API에서 상태/팀명/동기화 시각만 갱신 */
export function mergePreservingLiveScoreFields(
  existing: LiveScoreboard | null | undefined,
  incoming: LiveScoreboard,
): LiveScoreboard {
  if (!existing) return incoming;
  return {
    ...existing,
    homeTeamName: incoming.homeTeamName || existing.homeTeamName,
    awayTeamName: incoming.awayTeamName || existing.awayTeamName,
    homeTeamLogo: incoming.homeTeamLogo || existing.homeTeamLogo,
    awayTeamLogo: incoming.awayTeamLogo || existing.awayTeamLogo,
    statusShort: incoming.statusShort,
    statusLong: incoming.statusLong,
    situation: incoming.situation ?? existing.situation,
    syncedAt: incoming.syncedAt,
  };
}

export function resolveScoreboardForApiWrite(
  match: {
    controlMode?: string | null;
    matchStatus?: string | null;
    liveScoreboard?: LiveScoreboard | null;
  },
  incoming: LiveScoreboard,
): LiveScoreboard {
  if (shouldPreserveLiveScoreFields(match, incoming.statusShort)) {
    return mergePreservingLiveScoreFields(match.liveScoreboard, incoming);
  }
  return incoming;
}

export function buildInningKey(scoreboard: LiveScoreboard): string {
  return `${scoreboard.statusShort}:${scoreboard.homeScore}:${scoreboard.awayScore}:${scoreboard.inning ?? "na"}`;
}

/** 운영자 공수교대 시 스코어보드 이닝 라벨을 운영자 페이즈에 맞춤 (수동 잠금 없이) */
export function overlayOperatorInningOnScoreboard(
  existing: LiveScoreboard | null | undefined,
  gameInning: number,
  inningHalf: InningHalf,
): LiveScoreboard | null {
  if (!existing) return null;
  return {
    ...existing,
    inning: gameInning,
    inningHalf,
    inningLabel: formatInningWithHalf(gameInning, inningHalf),
    syncedAt: new Date().toISOString(),
  };
}
