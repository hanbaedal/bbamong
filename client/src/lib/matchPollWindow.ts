import { MATCH_LIVE_WINDOW_BEFORE_MS } from "@shared/matchLiveWindow";

/** 경기 시작(KST) 몇 ms 전부터 클라이언트 DB 폴링 허용 */
export const CLIENT_POLL_START_BEFORE_MS = MATCH_LIVE_WINDOW_BEFORE_MS;

export function isWithinMatchPollWindow(
  startTime?: string | Date | null,
  beforeMs = CLIENT_POLL_START_BEFORE_MS,
  nowMs = Date.now(),
): boolean {
  if (!startTime) return false;
  const startMs = new Date(startTime).getTime();
  if (!Number.isFinite(startMs)) return false;
  return nowMs >= startMs - beforeMs;
}

export function msUntilMatchPollWindow(
  startTime?: string | Date | null,
  beforeMs = CLIENT_POLL_START_BEFORE_MS,
  nowMs = Date.now(),
): number | null {
  if (!startTime) return null;
  const startMs = new Date(startTime).getTime();
  if (!Number.isFinite(startMs)) return null;
  return Math.max(0, startMs - beforeMs - nowMs);
}

/** 운영자·사용자 MongoDB 폴링: 시작 5분 전 ~ 경기 종료 전 */
export function shouldClientPollMatch(
  startTime?: string | Date | null,
  matchStatus?: string | null,
  beforeMs = CLIENT_POLL_START_BEFORE_MS,
  nowMs = Date.now(),
): boolean {
  if (matchStatus === "completed" || matchStatus === "cancelled") return false;
  if (matchStatus === "ongoing") return true;
  return isWithinMatchPollWindow(startTime, beforeMs, nowMs);
}
