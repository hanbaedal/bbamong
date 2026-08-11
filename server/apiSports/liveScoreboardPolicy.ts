import type { LiveScoreboard } from "@shared/apiSportsTypes";
import { formatInningWithHalf, type InningHalf } from "@shared/gamePhaseTypes";
import { isGameFinished } from "@shared/apiSportsStatus";

/**
 * 라이브 중(또는 수동 모드)에는 API가 점수·이닝 표를 덮어쓰지 않음.
 * - scheduled → ongoing 첫 반영은 허용 (matchStatus 가 아직 scheduled)
 * - API 종료(FT 등) + auto 이면 최종 스코어 반영
 * - manual 이면 종료 시에도 운영자/관리자 보정 점수 유지
 */
export function shouldPreserveLiveScoreFields(
  match: { controlMode?: string | null; matchStatus?: string | null },
  apiStatusShort: string | null | undefined,
): boolean {
  if (match.controlMode === "manual") return true;
  const apiFinished = isGameFinished(apiStatusShort);
  if (match.matchStatus === "ongoing" && !apiFinished) return true;
  return false;
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
    statusShort: incoming.statusShort,
    statusLong: incoming.statusLong,
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
