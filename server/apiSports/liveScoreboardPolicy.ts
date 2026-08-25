import type { LiveScoreboard } from "@shared/apiSportsTypes";

/**
 * 실황 피드는 예측 게임과 분리된 참고 표시다.
 *
 * 필드 주인 (같은 숫자를 두 소스에서 가져오지 않음):
 * - 다음: 점수·이닝표·R/H/E/B·상태·팀명·로고
 * - 네이버: 주자·B-S·OUT·타자·구종 (`situation`)
 * - 운영자: 예측 타순·공수교대·결과 (`gameInning` / `inningHalf`) — liveScoreboard 이닝을 덮지 않음
 *
 * 수동 잠금(controlMode=manual)일 때만 다음이 점수·이닝 표를 덮어쓰지 않음.
 * auto면 경기 중에도 다음 스코어를 반영한다. 운영자 보정 시에만 manual.
 * 다음 종료(FT 등) + auto 이면 최종 스코어 반영.
 * manual 이면 종료 시에도 운영자/관리자 보정 점수 유지.
 * 네이버 situation 은 auto/manual 모두 갱신하되, 이번 폴링이 비면 직전 값을 유지한다.
 */
export function shouldPreserveLiveScoreFields(
  match: { controlMode?: string | null; matchStatus?: string | null },
  _apiStatusShort?: string | null,
): boolean {
  return match.controlMode === "manual";
}

/** 네이버 타석만 붙인다. 점수·이닝은 incoming(다음) 값을 쓰지 않는다. */
export function attachNaverSituation(
  board: LiveScoreboard,
  situation: LiveScoreboard["situation"] | undefined,
  previous?: LiveScoreboard["situation"],
): LiveScoreboard {
  return {
    ...board,
    situation: carryForwardAtBatResult(situation ?? previous ?? null, previous ?? null),
  };
}

/** 타자가 바뀌어 실황 결과가 비어도 직전 타석 결과를 유지한다 (새 타석 투구가 시작되면 지움) */
export function carryForwardAtBatResult(
  next: LiveScoreboard["situation"] | null | undefined,
  prev: LiveScoreboard["situation"] | null | undefined,
): LiveScoreboard["situation"] | null {
  if (!next) return prev ?? null;
  if (next.atBatResultDisplay) return next;
  if (!prev?.atBatResultDisplay) return next;
  const batterChanged =
    Boolean(next.batterName) &&
    Boolean(prev.batterName) &&
    next.batterName !== prev.batterName;
  const newAtBatPitches =
    (next.balls ?? 0) > 0 ||
    (next.strikes ?? 0) > 0 ||
    (next.pitchLocations?.length ?? 0) > 0;
  if (batterChanged && newAtBatPitches) return next;
  return {
    ...next,
    atBatResultDisplay: prev.atBatResultDisplay,
    suggestedResult: next.suggestedResult ?? prev.suggestedResult ?? null,
  };
}

/**
 * 다음 보드 + 기존 보드를 필드 주인 기준으로 합친다.
 * incoming.situation 이 비면(네이버 실패·중계 없음) 직전 situation 을 유지한다.
 */
export function mergeExclusiveLiveScoreboard(
  existing: LiveScoreboard | null | undefined,
  incoming: LiveScoreboard,
  options: { preserveScoreFields: boolean },
): LiveScoreboard {
  const situation = carryForwardAtBatResult(
    incoming.situation ?? existing?.situation ?? null,
    existing?.situation ?? null,
  );
  if (options.preserveScoreFields && existing) {
    return {
      ...existing,
      homeTeamName: incoming.homeTeamName || existing.homeTeamName,
      awayTeamName: incoming.awayTeamName || existing.awayTeamName,
      homeTeamLogo: incoming.homeTeamLogo || existing.homeTeamLogo,
      awayTeamLogo: incoming.awayTeamLogo || existing.awayTeamLogo,
      statusShort: incoming.statusShort,
      statusLong: incoming.statusLong,
      situation,
      syncedAt: incoming.syncedAt,
    };
  }
  return { ...incoming, situation };
}

/** 기존 보드의 점수·이닝 표를 유지하고, 다음에서 상태/팀명/동기화 시각만 갱신 */
export function mergePreservingLiveScoreFields(
  existing: LiveScoreboard | null | undefined,
  incoming: LiveScoreboard,
): LiveScoreboard {
  return mergeExclusiveLiveScoreboard(existing, incoming, { preserveScoreFields: true });
}

export function resolveScoreboardForApiWrite(
  match: {
    controlMode?: string | null;
    matchStatus?: string | null;
    liveScoreboard?: LiveScoreboard | null;
  },
  incoming: LiveScoreboard,
): LiveScoreboard {
  return mergeExclusiveLiveScoreboard(match.liveScoreboard, incoming, {
    preserveScoreFields: shouldPreserveLiveScoreFields(match, incoming.statusShort),
  });
}

export function buildInningKey(scoreboard: LiveScoreboard): string {
  return `${scoreboard.statusShort}:${scoreboard.homeScore}:${scoreboard.awayScore}:${scoreboard.inning ?? "na"}`;
}
