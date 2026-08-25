/** 운영자·사용자 활성화 및 실황 폴링 시작: 경기 시작 N분 전 */
export const MATCH_LIVE_WINDOW_BEFORE_MS = 5 * 60_000;

export function matchStartMs(startTime?: Date | string | null): number | null {
  if (!startTime) return null;
  const startMs = new Date(startTime).getTime();
  return Number.isFinite(startMs) ? startMs : null;
}

/** 경기 시작 N분 전부터 운영자 컨트롤·사용자 참여/폴링 허용 */
export function isMatchLiveWindowOpen(
  startTime?: Date | string | null,
  nowMs = Date.now(),
  beforeMs = MATCH_LIVE_WINDOW_BEFORE_MS,
): boolean {
  const startMs = matchStartMs(startTime);
  if (startMs == null) return false;
  return nowMs >= startMs - beforeMs;
}
