import { MatchModel } from "../UserStorage/db";
import { getKstDateString } from "../utils/dateUtils";
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
    `[LiveScoreSync] started ${matchId} every ${LIVE_SCORE_SYNC_INTERVAL_MS}ms (order≤${LIVE_SCORE_MAX_REGISTRATION_ORDER})`,
  );
}

/**
 * 오늘 1경기(registrationOrder=1) — 시작 1분 전 ~ endTime 구간 api-sports live sync
 */
export async function scheduleLiveScoreSync(): Promise<void> {
  stopLiveScoreSync();

  if (!process.env.API_SPORTS_KEY?.trim()) return;

  const kstToday = getKstDateString();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const match = await MatchModel.findOne({
    apiSportsGameId: { $ne: null },
    registrationOrder: { $gte: 1, $lte: LIVE_SCORE_MAX_REGISTRATION_ORDER },
    matchStatus: { $nin: ["completed", "cancelled"] },
    $or: [{ matchDate: kstToday }, { matchDate: null, startTime: { $gte: today, $lt: tomorrow } }],
  })
    .sort({ registrationOrder: 1 })
    .lean();

  if (!match?.startTime || !match.endTime) return;

  const now = Date.now();
  const windowStartMs = new Date(match.startTime).getTime() - LIVE_SCORE_SYNC_START_BEFORE_MS;
  const windowEndMs = new Date(match.endTime).getTime();

  if (now >= windowEndMs) return;

  if (now >= windowStartMs) {
    beginLiveScoreInterval(match.id);
  } else {
    liveTimers.windowStart = setTimeout(() => beginLiveScoreInterval(match.id), windowStartMs - now);
  }

  if (now < windowEndMs) {
    liveTimers.windowEnd = setTimeout(() => {
      console.log(`[LiveScoreSync] window ended ${match.id}`);
      stopLiveScoreSync();
    }, windowEndMs - now);
  }
}
