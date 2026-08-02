import { MatchModel } from "../UserStorage/db";
import { getKstDateString } from "../utils/dateUtils";
import { isApiSyncEnabledForRegistrationOrder } from "../managerOperatorService";
import {
  LIVE_SCORE_MAX_REGISTRATION_ORDER,
  LIVE_SCORE_SYNC_INTERVAL_MS,
  LIVE_SCORE_SYNC_START_BEFORE_MS,
} from "./constants";
import { refreshMatchLiveScoreFromApi } from "./syncService";

const liveTimers = {
  windowStart: null as NodeJS.Timeout | null,
  windowEnd: null as NodeJS.Timeout | null,
  interval: null as NodeJS.Timeout | null,
};

let activeMatchId: string | null = null;

export function isLiveScoreSyncActive(): boolean {
  return liveTimers.interval !== null;
}

export function stopLiveScoreSync(): void {
  if (liveTimers.windowStart) clearTimeout(liveTimers.windowStart);
  if (liveTimers.windowEnd) clearTimeout(liveTimers.windowEnd);
  if (liveTimers.interval) clearInterval(liveTimers.interval);
  liveTimers.windowStart = null;
  liveTimers.windowEnd = null;
  liveTimers.interval = null;
  activeMatchId = null;
}

async function runLiveScoreTick(matchId: string): Promise<void> {
  try {
    const shouldStop = await refreshMatchLiveScoreFromApi(matchId);
    if (shouldStop) stopLiveScoreSync();
  } catch (error) {
    console.error(`[LiveScoreSync] tick failed (${matchId}):`, error);
  }
}

function beginLiveScoreInterval(matchId: string): void {
  if (activeMatchId === matchId && liveTimers.interval) return;

  if (liveTimers.interval) clearInterval(liveTimers.interval);

  activeMatchId = matchId;
  void runLiveScoreTick(matchId);
  liveTimers.interval = setInterval(() => void runLiveScoreTick(matchId), LIVE_SCORE_SYNC_INTERVAL_MS);
  console.log(
    `[LiveScoreSync] started ${matchId} every ${LIVE_SCORE_SYNC_INTERVAL_MS}ms (order≤${LIVE_SCORE_MAX_REGISTRATION_ORDER}, operator API ON)`,
  );
}

/**
 * 오늘 registrationOrder≤LIVE_SCORE_MAX 경기 live sync.
 * 운영자 리스트 API 폴링 ON인 슬롯만 대상 (기본 1경기=op1).
 */
export async function scheduleLiveScoreSync(): Promise<void> {
  stopLiveScoreSync();

  if (!process.env.API_SPORTS_KEY?.trim()) return;

  const kstToday = getKstDateString();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const candidates = await MatchModel.find({
    apiSportsGameId: { $ne: null },
    registrationOrder: { $gte: 1, $lte: LIVE_SCORE_MAX_REGISTRATION_ORDER },
    matchStatus: { $nin: ["completed", "cancelled"] },
    $or: [{ matchDate: kstToday }, { matchDate: null, startTime: { $gte: today, $lt: tomorrow } }],
  })
    .sort({ registrationOrder: 1 })
    .lean();

  let match: (typeof candidates)[number] | null = null;
  for (const candidate of candidates) {
    const order = candidate.registrationOrder ?? 0;
    const enabled = await isApiSyncEnabledForRegistrationOrder(order);
    if (!enabled) {
      console.log(
        `[LiveScoreSync] skip order=${order} (${candidate.name}) — 운영자 API 폴링 OFF`,
      );
      continue;
    }
    match = candidate;
    break;
  }

  if (!match?.startTime || !match.endTime) return;

  const now = Date.now();
  const windowStartMs = new Date(match.startTime).getTime() - LIVE_SCORE_SYNC_START_BEFORE_MS;
  const windowEndMs = new Date(match.endTime).getTime();

  if (now >= windowEndMs) return;

  if (now >= windowStartMs) {
    beginLiveScoreInterval(match.id);
  } else {
    const matchId = match.id;
    liveTimers.windowStart = setTimeout(() => beginLiveScoreInterval(matchId), windowStartMs - now);
    console.log(
      `[LiveScoreSync] armed ${matchId} (order=${match.registrationOrder}) in ${Math.round((windowStartMs - now) / 1000)}s`,
    );
  }

  if (now < windowEndMs) {
    const matchId = match.id;
    liveTimers.windowEnd = setTimeout(() => {
      console.log(`[LiveScoreSync] window ended ${matchId}`);
      stopLiveScoreSync();
    }, windowEndMs - now);
  }
}
