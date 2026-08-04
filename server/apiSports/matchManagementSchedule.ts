import { MatchModel } from "../UserStorage/db";
import { getKstDateString, getKstDayRange } from "../utils/dateUtils";
import { msUntilNextKstHour, scheduleDailyKst } from "../utils/kstSchedule";
import { isApiSyncEnabledForRegistrationOrder, syncOperatorMatchAssignments } from "../managerOperatorService";
import {
  backfillSeasonMatchesBeforeToday,
  refreshMatchFromApiAtEnd,
  refreshMatchFromApiAtStart,
  refreshStalePastMatchScores,
  syncTodayGamesFromApiSports,
} from "./syncService";
import { scheduleLiveScoreSync, stopLiveScoreSync } from "./liveScoreSync";

const MAX_DAILY_MATCHES = 5;

const dailyHourKst = parseInt(process.env.MATCH_MGMT_DAILY_SYNC_HOUR_KST || "9", 10);
const dailyMinuteKst = parseInt(process.env.MATCH_MGMT_DAILY_SYNC_MINUTE_KST || "0", 10);

const timersByMatch = new Map<string, { start?: NodeJS.Timeout; end?: NodeJS.Timeout }>();
let cancelDailySchedule: (() => void) | null = null;
let hourlyPregameTimer: NodeJS.Timeout | null = null;
let hourlyPregameRunning = false;

function clearMatchTimers(matchId: string) {
  const timers = timersByMatch.get(matchId);
  if (timers?.start) clearTimeout(timers.start);
  if (timers?.end) clearTimeout(timers.end);
  timersByMatch.delete(matchId);
}

function clearAllMatchTimers() {
  for (const matchId of timersByMatch.keys()) {
    clearMatchTimers(matchId);
  }
}

function clearHourlyPregameTimer() {
  if (hourlyPregameTimer) {
    clearTimeout(hourlyPregameTimer);
    hourlyPregameTimer = null;
  }
}

/** 오늘 연결 경기 중 가장 빠른 시작 시각 (없으면 null) */
async function findEarliestTodayStartMs(): Promise<number | null> {
  const kstToday = getKstDateString();
  const { start: todayStart, end: todayEnd } = getKstDayRange(new Date(`${kstToday}T12:00:00+09:00`));

  const matches = await MatchModel.find({
    apiSportsGameId: { $ne: null },
    matchStatus: { $nin: ["cancelled"] },
    registrationOrder: { $gte: 1, $lte: MAX_DAILY_MATCHES },
    $or: [
      { matchDate: kstToday },
      { matchDate: null, startTime: { $gte: todayStart, $lte: todayEnd } },
    ],
  })
    .select("startTime")
    .lean();

  let earliest: number | null = null;
  for (const match of matches) {
    if (!match.startTime) continue;
    const startMs = new Date(match.startTime).getTime();
    if (!Number.isFinite(startMs)) continue;
    if (earliest == null || startMs < earliest) earliest = startMs;
  }
  return earliest;
}

/**
 * KST 정시마다 오늘 일정 API → Match DB (첫 경기 시작 전까지만).
 * 09:00 일일 sync 이후 10:00, 11:00 … — 호출 1회/정시(날짜별 games 목록).
 */
export async function scheduleHourlyPregameSync(): Promise<void> {
  clearHourlyPregameTimer();

  const cutoff = await findEarliestTodayStartMs();
  const now = Date.now();
  if (cutoff != null && now >= cutoff) {
    console.log("[MatchMgmtSchedule] hourly pregame idle — first match already started");
    return;
  }

  const delay = msUntilNextKstHour();
  if (cutoff != null && now + delay >= cutoff) {
    console.log(
      `[MatchMgmtSchedule] hourly pregame stop — next hour is after first start (${new Date(cutoff).toISOString()})`,
    );
    return;
  }

  hourlyPregameTimer = setTimeout(() => {
    void runHourlyPregameMatchSync().catch((error) => {
      console.error("[MatchMgmtSchedule] hourly pregame failed:", error);
      void scheduleHourlyPregameSync();
    });
  }, delay);

  console.log(
    `[MatchMgmtSchedule] hourly pregame next in ${Math.round(delay / 60_000)}m` +
      (cutoff != null ? ` (until ${new Date(cutoff).toISOString()})` : ""),
  );
}

/** 프리게임 시간당 — 당일 1~5경기 Match DB 갱신 */
export async function runHourlyPregameMatchSync(): Promise<void> {
  if (hourlyPregameRunning) return;
  hourlyPregameRunning = true;
  try {
    const cutoff = await findEarliestTodayStartMs();
    if (cutoff != null && Date.now() >= cutoff) {
      clearHourlyPregameTimer();
      console.log("[MatchMgmtSchedule] hourly pregame skipped — first match started");
      return;
    }

    const date = getKstDateString();
    console.log(`[MatchMgmtSchedule] hourly pregame sync ${date}`);
    const result = await syncTodayGamesFromApiSports(date, { forceApi: true });
    console.log(
      `[MatchMgmtSchedule] hourly ${date}: created ${result.created}, updated ${result.updated}, linked ${result.linked}, source ${result.source}`,
    );
    await syncOperatorMatchAssignments();
    await rescheduleTodayMatchTimers();
  } finally {
    hourlyPregameRunning = false;
  }
}

/** ① 매일 09:00 KST — 오늘 1~5경기 api-sports → Match DB */
export async function runDailyMatchScheduleSync(): Promise<void> {
  const date = getKstDateString();
  console.log(`[MatchMgmtSchedule] daily Match sync ${date}`);
  const result = await syncTodayGamesFromApiSports(date, { forceApi: true });
  console.log(
    `[MatchMgmtSchedule] daily ${date}: created ${result.created}, updated ${result.updated}, linked ${result.linked}, source ${result.source}`,
  );
  await syncOperatorMatchAssignments();
  await rescheduleTodayMatchTimers();
}

/** ② 시작 시각 · ③ 종료 시각 타이머 재등록 + 프리게임 시간당 + 1경기 live */
export async function rescheduleTodayMatchTimers(): Promise<void> {
  clearAllMatchTimers();

  const kstToday = getKstDateString();
  const { start: todayStart, end: todayEnd } = getKstDayRange(new Date(`${kstToday}T12:00:00+09:00`));

  const matches = await MatchModel.find({
    apiSportsGameId: { $ne: null },
    matchStatus: { $nin: ["completed", "cancelled"] },
    registrationOrder: { $gte: 1, $lte: MAX_DAILY_MATCHES },
    $or: [
      { matchDate: kstToday },
      { matchDate: null, startTime: { $gte: todayStart, $lte: todayEnd } },
    ],
  }).lean();

  const now = Date.now();

  for (const match of matches) {
    if (!match.startTime || !match.endTime) continue;

    const order = match.registrationOrder ?? 0;
    const apiSyncEnabled = order >= 1 && order <= MAX_DAILY_MATCHES
      ? await isApiSyncEnabledForRegistrationOrder(order)
      : false;
    if (!apiSyncEnabled) continue;

    const startMs = new Date(match.startTime).getTime();
    const endMs = new Date(match.endTime).getTime();
    const entry: { start?: NodeJS.Timeout; end?: NodeJS.Timeout } = {};

    if (startMs > now) {
      entry.start = setTimeout(() => {
        void refreshMatchFromApiAtStart(match.id).catch((error) => {
          console.error(`[MatchMgmtSchedule] start sync failed (${match.id}):`, error);
        });
      }, startMs - now);
    } else if (match.matchStatus === "scheduled") {
      void refreshMatchFromApiAtStart(match.id).catch((error) => {
        console.error(`[MatchMgmtSchedule] start catch-up failed (${match.id}):`, error);
      });
    }

    if (endMs > now) {
      entry.end = setTimeout(() => {
        void refreshMatchFromApiAtEnd(match.id).catch((error) => {
          console.error(`[MatchMgmtSchedule] end sync failed (${match.id}):`, error);
        });
      }, endMs - now);
    } else if (match.matchStatus !== "completed") {
      void refreshMatchFromApiAtEnd(match.id).catch((error) => {
        console.error(`[MatchMgmtSchedule] end catch-up failed (${match.id}):`, error);
      });
    }

    timersByMatch.set(match.id, entry);
  }

  console.log(`[MatchMgmtSchedule] scheduled start/end for ${matches.length} match(es)`);
  await scheduleLiveScoreSync();
  await scheduleHourlyPregameSync();
}

async function maybeRunMissedDailySync(): Promise<void> {
  const kstToday = getKstDateString();
  const linkedCount = await MatchModel.countDocuments({
    matchDate: kstToday,
    apiSportsGameId: { $ne: null },
  });

  if (linkedCount === 0) {
    await runDailyMatchScheduleSync();
    return;
  }

  await rescheduleTodayMatchTimers();
}

async function runStartupMatchManagementSync(): Promise<void> {
  await backfillSeasonMatchesBeforeToday();
  await refreshStalePastMatchScores();
  await maybeRunMissedDailySync();
}

export function startMatchManagementSchedule(): void {
  if (!process.env.API_SPORTS_KEY?.trim()) {
    console.log("[MatchMgmtSchedule] API_SPORTS_KEY 없음 — 경기관리 스케줄 비활성");
    return;
  }

  if (cancelDailySchedule) return;

  const hour = Number.isFinite(dailyHourKst) ? Math.min(23, Math.max(0, dailyHourKst)) : 9;
  const minute = Number.isFinite(dailyMinuteKst) ? Math.min(59, Math.max(0, dailyMinuteKst)) : 0;

  cancelDailySchedule = scheduleDailyKst(hour, minute, () => runDailyMatchScheduleSync());

  void runStartupMatchManagementSync().catch((error) => {
    console.error("[MatchMgmtSchedule] startup sync failed:", error);
  });

  console.log(
    `[MatchMgmtSchedule] daily KST ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} · hourly pregame until first start · start=status · end=score · live=1경기`,
  );
}

export function stopMatchManagementSchedule(): void {
  cancelDailySchedule?.();
  cancelDailySchedule = null;
  clearHourlyPregameTimer();
  clearAllMatchTimers();
  stopLiveScoreSync();
}
