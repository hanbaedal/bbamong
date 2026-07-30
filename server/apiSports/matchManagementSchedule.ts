import { MatchModel } from "../UserStorage/db";
import { getKstDateString, getKstDayRange } from "../utils/dateUtils";
import { scheduleDailyKst } from "../utils/kstSchedule";
import { syncOperatorMatchAssignments } from "../managerOperatorService";
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

/** ① 매일 09:00 KST — 오늘 1~5경기 api-sports → Match DB + 최근 stale 과거일 보정 */
export async function runDailyMatchScheduleSync(): Promise<void> {
  const date = getKstDateString();
  console.log(`[MatchMgmtSchedule] daily Match sync ${date}`);
  const result = await syncTodayGamesFromApiSports(date, { forceApi: true });
  console.log(
    `[MatchMgmtSchedule] daily ${date}: created ${result.created}, updated ${result.updated}, linked ${result.linked}, source ${result.source}`,
  );

  const stale = await refreshStalePastMatchScores(7);
  if (stale.daysRefreshed > 0) {
    console.log(
      `[MatchMgmtSchedule] stale past catch-up: ${stale.daysRefreshed} day(s), ${stale.updated} match(es) updated`,
    );
  }

  await syncOperatorMatchAssignments();
  await rescheduleTodayMatchTimers();
}

/** ② 시작 시각 · ③ 종료 시각 타이머 재등록 */
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
    `[MatchMgmtSchedule] daily KST ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} · backfill · start=status · end=score · live=1경기`,
  );
}

export function stopMatchManagementSchedule(): void {
  cancelDailySchedule?.();
  cancelDailySchedule = null;
  clearAllMatchTimers();
  stopLiveScoreSync();
}
