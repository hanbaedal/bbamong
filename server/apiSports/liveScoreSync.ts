import { MatchModel } from "../UserStorage/db";
import { getKstDateString } from "../utils/dateUtils";
import { isApiSyncEnabledForRegistrationOrder, isAnyOperatorApiSyncEnabled } from "../managerOperatorService";
import {
  LIVE_SCORE_MAX_REGISTRATION_ORDER,
  LIVE_SCORE_SYNC_INTERVAL_MS,
  LIVE_SCORE_SYNC_START_BEFORE_MS,
} from "./constants";
import { refreshMatchLiveScoreFromApi } from "./syncService";

type MatchLiveTimers = {
  windowStart: NodeJS.Timeout | null;
  windowEnd: NodeJS.Timeout | null;
  interval: NodeJS.Timeout | null;
  starting: boolean;
  tickInFlight: boolean;
};

const liveTimersByMatch = new Map<string, MatchLiveTimers>();

function getOrCreateTimers(matchId: string): MatchLiveTimers {
  let timers = liveTimersByMatch.get(matchId);
  if (!timers) {
    timers = {
      windowStart: null,
      windowEnd: null,
      interval: null,
      starting: false,
      tickInFlight: false,
    };
    liveTimersByMatch.set(matchId, timers);
  }
  return timers;
}

export function isLiveScoreSyncActive(): boolean {
  for (const timers of liveTimersByMatch.values()) {
    if (timers.interval || timers.starting) return true;
  }
  return false;
}

function stopLiveScoreSyncForMatch(matchId: string): void {
  const timers = liveTimersByMatch.get(matchId);
  if (!timers) return;

  if (timers.windowStart) clearTimeout(timers.windowStart);
  if (timers.windowEnd) clearTimeout(timers.windowEnd);
  if (timers.interval) clearInterval(timers.interval);
  liveTimersByMatch.delete(matchId);
}

export function stopLiveScoreSync(): void {
  for (const matchId of Array.from(liveTimersByMatch.keys())) {
    stopLiveScoreSyncForMatch(matchId);
  }
}

async function runLiveScoreTick(matchId: string): Promise<void> {
  const timers = liveTimersByMatch.get(matchId);
  if (!timers || timers.tickInFlight) return;
  timers.tickInFlight = true;
  try {
    const shouldStop = await refreshMatchLiveScoreFromApi(matchId);
    if (shouldStop) stopLiveScoreSyncForMatch(matchId);
  } catch (error) {
    console.error(`[LiveScoreSync] tick failed (${matchId}):`, error);
  } finally {
    const current = liveTimersByMatch.get(matchId);
    if (current) current.tickInFlight = false;
  }
}

function beginLiveScoreInterval(matchId: string, registrationOrder?: number): void {
  const timers = getOrCreateTimers(matchId);
  if (timers.interval || timers.starting) return;
  timers.starting = true;

  void (async () => {
    try {
      const order = registrationOrder ?? 0;
      if (order >= 1 && order <= 5 && !(await isApiSyncEnabledForRegistrationOrder(order))) {
        console.log(`[LiveScoreSync] abort start ${matchId} — order=${order} API OFF`);
        stopLiveScoreSyncForMatch(matchId);
        return;
      }

      if (!liveTimersByMatch.has(matchId)) return;
      void runLiveScoreTick(matchId);
      timers.interval = setInterval(() => void runLiveScoreTick(matchId), LIVE_SCORE_SYNC_INTERVAL_MS);
      console.log(
        `[LiveScoreSync] started ${matchId} every ${LIVE_SCORE_SYNC_INTERVAL_MS}ms (order=${registrationOrder ?? "?"}, operator API ON)`,
      );
    } finally {
      if (liveTimersByMatch.get(matchId) === timers) {
        timers.starting = false;
      }
    }
  })();
}

function scheduleLiveScoreWindow(
  match: { id: string; startTime?: Date | null; endTime?: Date | null; registrationOrder?: number | null },
): void {
  if (!match.startTime || !match.endTime) return;

  const now = Date.now();
  const windowStartMs = new Date(match.startTime).getTime() - LIVE_SCORE_SYNC_START_BEFORE_MS;
  const windowEndMs = new Date(match.endTime).getTime();
  if (now >= windowEndMs) return;

  const matchId = match.id;
  const order = match.registrationOrder ?? undefined;
  const timers = getOrCreateTimers(matchId);

  if (now >= windowStartMs) {
    beginLiveScoreInterval(matchId, order);
  } else if (!timers.windowStart) {
    timers.windowStart = setTimeout(
      () => beginLiveScoreInterval(matchId, order),
      windowStartMs - now,
    );
    console.log(
      `[LiveScoreSync] armed ${matchId} (order=${order ?? "?"}) in ${Math.round((windowStartMs - now) / 1000)}s`,
    );
  }

  if (now < windowEndMs && !timers.windowEnd) {
    timers.windowEnd = setTimeout(() => {
      console.log(`[LiveScoreSync] window ended ${matchId}`);
      stopLiveScoreSyncForMatch(matchId);
    }, windowEndMs - now);
  }
}

/**
 * 오늘 op1~op5 담당 경기 중 API 폴링 ON인 경기만 live sync.
 * op3 ON → 제3경기만 — 담당 경기 표시·폴링 모두 슬롯 고정.
 */
export async function scheduleLiveScoreSync(): Promise<void> {
  stopLiveScoreSync();

  if (!process.env.API_SPORTS_KEY?.trim()) return;
  if (!(await isAnyOperatorApiSyncEnabled())) {
    console.log("[LiveScoreSync] idle — all operator API polling OFF");
    return;
  }

  const kstToday = getKstDateString();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const candidates = await MatchModel.find({
    apiSportsGameId: { $ne: null },
    registrationOrder: { $gte: 1, $lte: 5 },
    matchStatus: { $nin: ["completed", "cancelled"] },
    $or: [{ matchDate: kstToday }, { matchDate: null, startTime: { $gte: today, $lt: tomorrow } }],
  })
    .sort({ registrationOrder: 1 })
    .lean();

  let liveSlotsUsed = 0;

  for (const candidate of candidates) {
    const order = candidate.registrationOrder ?? 0;
    const enabled = await isApiSyncEnabledForRegistrationOrder(order);
    if (!enabled) {
      console.log(
        `[LiveScoreSync] skip order=${order} (${candidate.name}) — 운영자 API 폴링 OFF`,
      );
      continue;
    }
    if (liveSlotsUsed >= LIVE_SCORE_MAX_REGISTRATION_ORDER) {
      console.log(
        `[LiveScoreSync] skip order=${order} (${candidate.name}) — live sync 슬롯 상한 ${LIVE_SCORE_MAX_REGISTRATION_ORDER}`,
      );
      continue;
    }
    liveSlotsUsed += 1;
    scheduleLiveScoreWindow(candidate);
  }
}
