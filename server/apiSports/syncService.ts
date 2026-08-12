import { randomUUID } from "crypto";
import { MatchModel, StadiumModel, PredictionModel, RoundStatisticsModel, getNextSequence } from "../UserStorage/db";
import { finalizeMatchEnd } from "../liveMatch/sideBetStorage";
import { broadcastManager } from "../liveMatch/broadcastManager";
import { addKstDays, getKstDateString, getKstDayRange } from "../utils/dateUtils";
import { fetchGameById, apiSportsTeamIdsFromGame, type ApiSportsGameResponse } from "./client";
import { markApiSportsError } from "./healthState";
import type {
  ApiSportsTodayGame,
  InningRunsMap,
  LiveScoreboard,
  MatchControlMode,
  MatchHeadToHeadSnapshot,
  MatchLineupSnapshot,
  MatchPlayerStatsEntry,
} from "@shared/apiSportsTypes";
import {
  buildInningKey,
  isGameFinished,
  isGameLiveStatus,
  isGamePostponedOrCancelled,
  parseLiveScoreboard,
} from "./scoreboardParser";
import { getScheduleGamesForDate, importSeasonScheduleToCache } from "./scheduleCache";
import { isApiSyncEnabledForRegistrationOrder } from "../managerOperatorService";
import { isConfirmedPostponedMatch, isGameNotStarted, normalizeApiStatusShort } from "@shared/apiSportsStatus";
import { LIVE_SCORE_NS_GATE_POLL_MS, LIVE_SCORE_SYNC_START_BEFORE_MS } from "./constants";
import { isStaleFinishedScoreboard, isStalePostponedScoreboard, isMisclassifiedTerminalStatus } from "@shared/matchManagementStatus";
import { refreshMatchLineupIfDue } from "./lineupService";
import { refreshMatchHeadToHeadIfDue } from "./h2hService";
import {
  API_PLACEHOLDER_STADIUM_NAME,
  formatKboTeamShortName,
  resolveVenueNameFromApiSportsGame,
} from "@shared/kboHomeStadium";
import { resolveScoreboardForApiWrite } from "./liveScoreboardPolicy";
import { formatInningWithHalf, parseInningHalf, type InningHalf } from "@shared/gamePhaseTypes";

const MAX_DAILY_MATCHES = 5;

function apiSportsTeamsUpdate(game: ApiSportsGameResponse, scoreboard: LiveScoreboard) {
  return {
    apiSportsHomeTeam: formatKboTeamShortName(scoreboard.homeTeamName),
    apiSportsAwayTeam: formatKboTeamShortName(scoreboard.awayTeamName),
    apiSportsHomeTeamLogo: game.teams.home.logo ?? scoreboard.homeTeamLogo ?? null,
    apiSportsAwayTeamLogo: game.teams.away.logo ?? scoreboard.awayTeamLogo ?? null,
    ...apiSportsTeamIdsFromGame(game),
  };
}

async function syncOperatorAccountForMatch(matchId: string): Promise<void> {
  try {
    const { syncOperatorAccountStatusForMatchId } = await import("../managerOperatorService");
    await syncOperatorAccountStatusForMatchId(matchId);
  } catch (error) {
    console.error(`[Operators] account status sync failed (${matchId}):`, error);
  }
}

/** 시작 30분 이상 전 — 오진입(시각 DB 오류 등) 잠금으로 보고 해제 가능 */
const PREGAME_SIDEBET_UNLOCK_BEFORE_MS = 30 * 60_000;

/**
 * 사이드벳 마감 플래그 결정.
 * - 진행·종료·이닝 시작 시 잠금
 * - 실황 시작 전(scheduled+NS)에는 오진입 잠금을 풀어 경기전 배팅을 복구
 * - 시작 임박 + 예측 오픈 중 NS 지연이면 잠금 유지
 */
export function resolveSideBetsLocked(input: {
  previouslyLocked?: boolean | null;
  predictionEnabled?: boolean | null;
  matchStatus: string;
  statusShort?: string | null;
  inning?: number | null;
  startTime?: Date | string | null;
  nowMs?: number;
}): boolean {
  const nowMs = input.nowMs ?? Date.now();
  const { matchStatus } = input;

  if (
    matchStatus === "ongoing" ||
    matchStatus === "completed" ||
    matchStatus === "cancelled"
  ) {
    return true;
  }
  if (input.inning != null) return true;
  if (isGameFinished(input.statusShort)) return true;

  if (matchStatus === "scheduled" && isGameNotStarted(input.statusShort)) {
    if (!input.previouslyLocked) return false;
    if (!input.predictionEnabled) return false;
    const startMs = input.startTime ? new Date(input.startTime).getTime() : Number.NaN;
    if (Number.isFinite(startMs) && nowMs < startMs - PREGAME_SIDEBET_UNLOCK_BEFORE_MS) {
      return false;
    }
    return true;
  }

  return Boolean(input.previouslyLocked);
}

/**
 * DB ongoing + API 스코어보드 시작 전(NS) 고착을 scheduled로 복구.
 * 예측 시작이 matchStatus를 올리지 않도록 바꾼 뒤, 기존 오진입 데이터 치유용.
 */
export async function reconcileStuckPregameOngoingStatuses(
  targetDate = getKstDateString(),
): Promise<number> {
  const matches = await MatchModel.find({
    matchStatus: "ongoing",
    $or: [{ matchDate: targetDate }, { matchDate: null }],
  })
    .select("id matchDate liveScoreboard startTime")
    .lean();

  let fixed = 0;
  for (const match of matches) {
    const matchDate =
      (match as { matchDate?: string | null }).matchDate ??
      (match.startTime ? getKstDateString(new Date(match.startTime)) : null);
    if (matchDate !== targetDate) continue;

    const sb = match.liveScoreboard as LiveScoreboard | null | undefined;
    if (!sb || !isGameNotStarted(sb.statusShort)) continue;
    if (sb.inning != null) continue;
    if (/\d+회/.test(sb.inningLabel ?? "") && !/종료|연기|취소/.test(sb.inningLabel ?? "")) {
      continue;
    }

    await MatchModel.updateOne({ id: match.id }, { $set: { matchStatus: "scheduled" } });
    await syncOperatorAccountForMatch(match.id);
    fixed += 1;
  }

  if (fixed > 0) {
    console.log(`[MatchStatus] reconciled ${fixed} ongoing→scheduled (API NS) on ${targetDate}`);
  }
  return fixed;
}

/** 경기전으로 되돌릴 때 RoundStatistics에 남은 예측 시작/중지 시각·플래그 제거 */
async function clearPregameRoundPredictionClocks(matchId: string): Promise<void> {
  await RoundStatisticsModel.updateMany(
    { matchId },
    {
      $set: {
        predictionStartTime: null,
        predictionStopTime: null,
        isPredictionStarted: false,
        isPredictionStopped: false,
      },
    },
  );
}

/**
 * 경기전(scheduled+NS)인데 sideBetsLocked/predictionEnabled가 고착된 경우 해제.
 * 시작 시각 DB 오류로 오전에 예측이 열린 뒤 시각만 고친 케이스를 복구합니다.
 * RoundStatistics 예측 시계도 함께 초기화합니다.
 */
export async function reconcileStuckPregameSideBetLocks(
  targetDate = getKstDateString(),
  nowMs = Date.now(),
): Promise<number> {
  // 잠금 고착뿐 아니라, 잠금은 풀렸지만 라운드 시각만 남은 경기전도 포함
  const matches = await MatchModel.find({
    matchStatus: "scheduled",
    $or: [{ matchDate: targetDate }, { matchDate: null }],
  })
    .select(
      "id matchDate liveScoreboard startTime sideBetsLocked predictionEnabled currentRound",
    )
    .lean();

  let fixed = 0;
  for (const match of matches) {
    const matchDate =
      (match as { matchDate?: string | null }).matchDate ??
      (match.startTime ? getKstDateString(new Date(match.startTime)) : null);
    if (matchDate !== targetDate) continue;

    const sb = match.liveScoreboard as LiveScoreboard | null | undefined;
    if (!sb || !isGameNotStarted(sb.statusShort)) continue;
    if (sb.inning != null) continue;

    const stillLocked = resolveSideBetsLocked({
      previouslyLocked: Boolean(match.sideBetsLocked),
      predictionEnabled: Boolean(match.predictionEnabled),
      matchStatus: "scheduled",
      statusShort: sb.statusShort,
      inning: sb.inning,
      startTime: match.startTime,
      nowMs,
    });
    if (stillLocked) continue;

    const startMs = match.startTime ? new Date(match.startTime).getTime() : Number.NaN;
    const earlyEnough =
      Number.isFinite(startMs) && nowMs < startMs - PREGAME_SIDEBET_UNLOCK_BEFORE_MS;

    const needsUnlock =
      Boolean(match.sideBetsLocked) || Boolean(match.predictionEnabled);
    const hasStaleRoundClock = await RoundStatisticsModel.exists({
      matchId: match.id,
      $or: [
        { predictionStartTime: { $ne: null } },
        { predictionStopTime: { $ne: null } },
        { isPredictionStarted: true },
        { isPredictionStopped: true },
      ],
    });
    if (!needsUnlock && !hasStaleRoundClock && !(earlyEnough && (match.currentRound ?? 1) > 1)) {
      continue;
    }

    const $set: Record<string, unknown> = {
      sideBetsLocked: false,
      predictionEnabled: false,
    };
    // 오전에 라운드가 진행된 오진입이면 저녁 경기 전에 라운드도 초기화
    if (earlyEnough && (match.currentRound ?? 1) > 1) {
      $set.currentRound = 1;
    }

    await MatchModel.updateOne({ id: match.id }, { $set });
    await clearPregameRoundPredictionClocks(match.id);
    await syncOperatorAccountForMatch(match.id);
    fixed += 1;
  }

  if (fixed > 0) {
    console.log(
      `[MatchStatus] reconciled ${fixed} pregame sideBet/prediction locks on ${targetDate}`,
    );
  }
  return fixed;
}

function gameStartDate(game: ApiSportsGameResponse): Date {
  if (game.timestamp && Number.isFinite(game.timestamp)) {
    // API-SPORTS timestamp is unix seconds
    return new Date(game.timestamp * 1000);
  }
  if (game.date && game.time) {
    return new Date(`${game.date.slice(0, 10)}T${game.time}:00+09:00`);
  }
  return new Date(`${getKstDateString()}T18:00:00+09:00`);
}

function matchStatusFromApi(statusShort: string): string {
  const short = (statusShort || "").toUpperCase();
  if (isGamePostponedOrCancelled(short)) return "cancelled";
  if (isGameFinished(short)) return "completed";
  if (short === "NS" || short === "TBD") return "scheduled";
  return "ongoing";
}

function hasStartTimeReached(startTime?: Date | null): boolean {
  if (!startTime) return false;
  return Date.now() >= new Date(startTime).getTime();
}

/** api-sports 응답 + 시작 시각 기준으로 경기관리 DB 상태 결정 */
export function resolveMatchStatusFromScoreboard(
  currentStatus: string,
  scoreboard: LiveScoreboard,
  startTime?: Date | null,
): string {
  const staleInput = {
    matchStatus: currentStatus,
    statusShort: scoreboard.statusShort,
    statusLong: scoreboard.statusLong,
    homeScore: scoreboard.homeScore,
    awayScore: scoreboard.awayScore,
    inning: scoreboard.inning,
    inningLabel: scoreboard.inningLabel,
  };

  if (isConfirmedPostponedMatch(staleInput)) {
    return "cancelled";
  }

  if (isGamePostponedOrCancelled(scoreboard.statusShort)) {
    if (!isStalePostponedScoreboard(staleInput)) {
      return "cancelled";
    }
  } else if (currentStatus === "cancelled" && !isStalePostponedScoreboard(staleInput)) {
    return "cancelled";
  }

  if (isMisclassifiedTerminalStatus(staleInput)) {
    return "ongoing";
  }

  if (
    isGameFinished(scoreboard.statusShort) &&
    !isStaleFinishedScoreboard(staleInput)
  ) {
    return "completed";
  }
  if (currentStatus === "completed" || currentStatus === "cancelled") {
    const staleCompleted =
      currentStatus === "completed" && isStaleFinishedScoreboard(staleInput);
    const staleCancelled =
      currentStatus === "cancelled" && isStalePostponedScoreboard(staleInput);
    if (!staleCompleted && !staleCancelled) {
      return currentStatus;
    }
  }
  if (isGameLiveStatus(scoreboard.statusShort) || scoreboard.inning !== null) {
    return "ongoing";
  }
  if (hasStartTimeReached(startTime)) {
    const totalRuns = (scoreboard.homeScore ?? 0) + (scoreboard.awayScore ?? 0);
    if (totalRuns > 0) return "ongoing";
  }
  // API가 시작 전(NS 등)이면 scheduled — 예측 시작으로 ongoing이 고착되지 않게 복귀
  if (isGameNotStarted(scoreboard.statusShort)) {
    return "scheduled";
  }
  // API 상태 신호가 없으면 종료·취소만 유지하고, ongoing은 올리지/유지하지 않음
  if (!normalizeApiStatusShort(scoreboard.statusShort)) {
    if (currentStatus === "completed" || currentStatus === "cancelled") {
      return currentStatus;
    }
    return "scheduled";
  }
  return currentStatus === "ongoing" ? "ongoing" : "scheduled";
}

async function ensureStadiumByName(name: string): Promise<number> {
  const trimmed = name.trim() || API_PLACEHOLDER_STADIUM_NAME;
  const existing = await StadiumModel.findOne({ name: trimmed }).lean();
  if (existing) return existing.id;

  const id = await getNextSequence("stadium");
  try {
    await StadiumModel.create({ id, name: trimmed });
    return id;
  } catch {
    // 동시 생성 시 유니크 충돌 → 재조회
    const again = await StadiumModel.findOne({ name: trimmed }).lean();
    if (again) return again.id;
    throw new Error(`구장 생성 실패: ${trimmed}`);
  }
}

function extractMatchOrder(name: string): number {
  const match = name.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function dayRangeForMatchDate(targetDate: string): { startOfDay: Date; endOfDay: Date } {
  const { start, end } = getKstDayRange(new Date(`${targetDate}T12:00:00+09:00`));
  return { startOfDay: start, endOfDay: end };
}

async function findMatchesForDate(targetDate: string) {
  const { startOfDay, endOfDay } = dayRangeForMatchDate(targetDate);
  return MatchModel.find({
    $or: [{ matchDate: targetDate }, { matchDate: null, startTime: { $gte: startOfDay, $lte: endOfDay } }],
  }).lean();
}

/** 같은 날·같은 registrationOrder(또는 N경기) 중복 제거 — 예측 없는 orphan만 삭제 */
async function dedupeDailyMatchesForDate(
  targetDate: string,
  activeApiIds: Set<number>,
): Promise<number> {
  const matches = await findMatchesForDate(targetDate);
  const groups = new Map<number, typeof matches>();

  for (const m of matches) {
    const order =
      (m as { registrationOrder?: number | null }).registrationOrder ??
      extractMatchOrder(m.name) ??
      0;
    if (order < 1) continue;
    const list = groups.get(order) ?? [];
    list.push(m);
    groups.set(order, list);
  }

  let removed = 0;

  for (const group of groups.values()) {
    if (group.length <= 1) continue;

    const ranked = [...group].sort((a, b) => {
      const aApi = (a as { apiSportsGameId?: number | null }).apiSportsGameId;
      const bApi = (b as { apiSportsGameId?: number | null }).apiSportsGameId;
      const aActive = aApi != null && activeApiIds.has(aApi) ? 1 : 0;
      const bActive = bApi != null && activeApiIds.has(bApi) ? 1 : 0;
      if (bActive !== aActive) return bActive - aActive;
      const aHas = aApi != null ? 1 : 0;
      const bHas = bApi != null ? 1 : 0;
      if (bHas !== aHas) return bHas - aHas;
      return String(a.id).localeCompare(String(b.id));
    });

    const [, ...dupes] = ranked;
    for (const dup of dupes) {
      const predCount = await PredictionModel.countDocuments({ matchId: dup.id });
      if (predCount > 0) continue;
      await MatchModel.deleteOne({ id: dup.id });
      removed += 1;
    }
  }

  if (removed > 0) {
    console.log(`[ApiSportsSync] ${targetDate} 중복 경기 ${removed}건 정리`);
  }

  return removed;
}

/** API에 해당일 경기 없음(forceApi) — 예측 없는 1~5경기 슬롯 orphan 제거 */
async function clearOrphanMatchesForDate(targetDate: string): Promise<number> {
  const matches = await findMatchesForDate(targetDate);
  let removed = 0;

  for (const m of matches) {
    const order =
      (m as { registrationOrder?: number | null }).registrationOrder ??
      extractMatchOrder(m.name) ??
      0;
    if (order < 1 || order > MAX_DAILY_MATCHES) continue;

    const predCount = await PredictionModel.countDocuments({ matchId: m.id });
    if (predCount > 0) continue;

    await MatchModel.deleteOne({ id: m.id });
    removed += 1;
  }

  if (removed > 0) {
    console.log(`[ApiSportsSync] ${targetDate} API 경기 없음 — orphan ${removed}건 제거`);
  }

  return removed;
}

function venueNameFromGame(game: ApiSportsGameResponse): string {
  return resolveVenueNameFromApiSportsGame({
    apiVenueName: game.venue?.name,
    homeTeamName: game.teams.home.name,
  });
}

export function mapTodayGames(games: ApiSportsGameResponse[]): ApiSportsTodayGame[] {
  return games
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((game) => {
      const scoreboard = parseLiveScoreboard(game);
      return {
        apiSportsGameId: game.id,
        date: game.date,
        time: game.time,
        homeTeamName: game.teams.home.name,
        awayTeamName: game.teams.away.name,
        statusShort: game.status.short,
        statusLong: game.status.long,
        homeScore: scoreboard.homeScore,
        awayScore: scoreboard.awayScore,
        venueName: venueNameFromGame(game),
      };
    });
}

/**
 * 해당일 KBO 일정을 API에서 읽어 DB에 자동 등록(최대 5경기)하고 연결합니다.
 * 수기 등록 없이 사용 가능. 이미 있으면 시각·팀·API ID를 갱신합니다.
 */
export async function syncTodayGamesFromApiSports(
  date?: string,
  options?: { forceApi?: boolean; skipExisting?: boolean },
): Promise<{
  created: number;
  updated: number;
  linked: number;
  deduped: number;
  cleared?: number;
  games: ApiSportsTodayGame[];
  source: "cache" | "api";
}> {
  const targetDate = date ?? getKstDateString();
  const isPastDate = targetDate < getKstDateString();
  const { games: apiGames, source } = await getScheduleGamesForDate(targetDate, {
    forceApi: options?.forceApi,
  });

  const sortedApi = apiGames
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, MAX_DAILY_MATCHES);
  const mapped = mapTodayGames(sortedApi);

  if (sortedApi.length === 0) {
    const cleared =
      options?.forceApi === true ? await clearOrphanMatchesForDate(targetDate) : 0;
    return { created: 0, updated: 0, linked: 0, deduped: 0, cleared, games: [], source };
  }

  const activeApiIds = new Set(sortedApi.map((g) => g.id));
  const dedupedBefore = await dedupeDailyMatchesForDate(targetDate, activeApiIds);

  const { startOfDay, endOfDay } = dayRangeForMatchDate(targetDate);

  const internalMatches = await MatchModel.find({
    $or: [{ matchDate: targetDate }, { matchDate: null, startTime: { $gte: startOfDay, $lte: endOfDay } }],
  }).lean();

  const byApiId = new Map(
    internalMatches
      .filter((m) => (m as { apiSportsGameId?: number | null }).apiSportsGameId != null)
      .map((m) => [(m as { apiSportsGameId: number }).apiSportsGameId, m]),
  );
  const byRegistrationOrder = new Map(
    internalMatches
      .filter((m) => (m as { registrationOrder?: number | null }).registrationOrder != null)
      .map((m) => [(m as { registrationOrder: number }).registrationOrder, m]),
  );
  const byName = new Map(internalMatches.map((m) => [m.name, m]));

  let created = 0;
  let updated = 0;
  let linked = 0;

  for (let i = 0; i < sortedApi.length; i++) {
    const external = sortedApi[i];
    const scoreboard = parseLiveScoreboard(external);
    const matchName = `${i + 1}경기`;
    const startTime = gameStartDate(external);
    const endTime = new Date(startTime.getTime() + 4 * 60 * 60 * 1000);
    const matchStatus = matchStatusFromApi(external.status.short);
    const stadiumId = await ensureStadiumByName(venueNameFromGame(external));

    const order = i + 1;
    const existing =
      byApiId.get(external.id) ??
      byRegistrationOrder.get(order) ??
      byName.get(matchName) ??
      null;

    if (options?.skipExisting && existing?.apiSportsGameId === external.id) {
      linked += 1;
      continue;
    }

    const resolvedStatus = resolveMatchStatusFromScoreboard(
      existing?.matchStatus ?? matchStatus,
      scoreboard,
      startTime,
    );
    const staleFinished = isStaleFinishedScoreboard({
      matchStatus: existing?.matchStatus,
      statusShort: scoreboard.statusShort,
      homeScore: scoreboard.homeScore,
      awayScore: scoreboard.awayScore,
      inning: scoreboard.inning,
      inningLabel: scoreboard.inningLabel,
    });
    const stalePostponed = isStalePostponedScoreboard({
      matchStatus: existing?.matchStatus,
      statusShort: scoreboard.statusShort,
      statusLong: scoreboard.statusLong,
      homeScore: scoreboard.homeScore,
      awayScore: scoreboard.awayScore,
      inning: scoreboard.inning,
      inningLabel: scoreboard.inningLabel,
    });
    const useFreshScoreboard =
      options?.forceApi ||
      isPastDate ||
      staleFinished ||
      stalePostponed ||
      isGameFinished(scoreboard.statusShort) ||
      isGamePostponedOrCancelled(scoreboard.statusShort) ||
      isGameNotStarted(scoreboard.statusShort) ||
      !existing?.liveScoreboard ||
      typeof existing.liveScoreboard.homeScore !== "number" ||
      typeof existing.liveScoreboard.awayScore !== "number" ||
      existing.matchStatus !== "ongoing";

    const payload = {
      name: matchName,
      stadiumId,
      matchDate: targetDate,
      startTime,
      endTime,
      matchStatus: resolvedStatus,
      registrationOrder: order,
      apiSportsGameId: external.id,
      ...apiSportsTeamsUpdate(external, scoreboard),
      liveScoreboard: useFreshScoreboard
        ? scoreboard
        : existing!.liveScoreboard,
      lastInningKey: existing?.lastInningKey ?? buildInningKey(scoreboard),
      controlMode: existing?.controlMode ?? "auto",
      sideBetsLocked: resolveSideBetsLocked({
        previouslyLocked: existing?.sideBetsLocked,
        predictionEnabled: existing?.predictionEnabled,
        matchStatus: resolvedStatus,
        statusShort: scoreboard.statusShort,
        inning: scoreboard.inning,
        startTime,
      }),
    };

    if (existing) {
      await MatchModel.updateOne({ id: existing.id }, payload);
      updated += 1;
      linked += 1;
      byApiId.set(external.id, { ...existing, ...payload });
      byRegistrationOrder.set(order, { ...existing, ...payload });
      byName.set(matchName, { ...existing, ...payload });
    } else {
      await MatchModel.create({
        id: randomUUID(),
        currentRound: 1,
        predictionEnabled: false,
        ...payload,
      });
      created += 1;
      linked += 1;
    }
  }

  const dedupedAfter = await dedupeDailyMatchesForDate(targetDate, activeApiIds);

  return {
    created,
    updated,
    linked,
    deduped: dedupedBefore + dedupedAfter,
    games: mapped,
    source,
  };
}

function currentSeasonYear(): number {
  const fromEnv = Number(process.env.API_SPORTS_SEASON || "");
  if (Number.isFinite(fromEnv) && fromEnv > 2000) return fromEnv;
  return Number(getKstDateString().slice(0, 4));
}

function seasonRangeStart(season: number): string {
  const mmdd = process.env.MATCH_MGMT_SEASON_START_MM_DD || "03-01";
  return `${season}-${mmdd}`;
}

function seasonRangeEnd(season: number): string {
  const mmdd = process.env.MATCH_MGMT_SEASON_END_MM_DD || "10-31";
  return `${season}-${mmdd}`;
}

const SEASON_IMPORT_DAY_DELAY_MS = Math.max(
  0,
  parseInt(process.env.MATCH_MGMT_SEASON_IMPORT_DELAY_MS || "80", 10) || 80,
);

/**
 * 시즌 전체(기본 3/1~10/31) 날짜별 Match DB 등록 — 경기관리 달력용
 * prefetchScheduleCache=true 이면 ApiSportsScheduleCache 선적재 후 Match 등록(API 절약)
 */
export async function importSeasonMatchesFromApiSports(
  season?: number,
  options?: { prefetchScheduleCache?: boolean; forceApi?: boolean },
): Promise<{
  season: number;
  daysChecked: number;
  daysSynced: number;
  daysEmpty: number;
  daysFromApi: number;
  created: number;
  updated: number;
  linked: number;
}> {
  const targetSeason = season ?? currentSeasonYear();
  const prefetchScheduleCache = options?.prefetchScheduleCache !== false;

  if (prefetchScheduleCache) {
    await importSeasonScheduleToCache(targetSeason);
  }

  let cursor = seasonRangeStart(targetSeason);
  const end = seasonRangeEnd(targetSeason);

  let daysChecked = 0;
  let daysSynced = 0;
  let daysEmpty = 0;
  let daysFromApi = 0;
  let created = 0;
  let updated = 0;
  let linked = 0;

  while (cursor <= end) {
    daysChecked += 1;

    let result = await syncTodayGamesFromApiSports(cursor, {
      forceApi: options?.forceApi ?? false,
    });

    if (result.games.length === 0 && !options?.forceApi) {
      result = await syncTodayGamesFromApiSports(cursor, { forceApi: true });
    }

    if (result.source === "api") {
      daysFromApi += 1;
    }

    if (result.games.length === 0) {
      daysEmpty += 1;
    } else {
      daysSynced += 1;
      created += result.created;
      updated += result.updated;
      linked += result.linked;
    }

    if (SEASON_IMPORT_DAY_DELAY_MS > 0) {
      await new Promise((resolve) => setTimeout(resolve, SEASON_IMPORT_DAY_DELAY_MS));
    }

    cursor = addKstDays(cursor, 1);
  }

  console.log(
    `[MatchMgmt] season ${targetSeason} Match import: days ${daysSynced}/${daysChecked}, created ${created}, updated ${updated}, apiDays ${daysFromApi}`,
  );

  return {
    season: targetSeason,
    daysChecked,
    daysSynced,
    daysEmpty,
    daysFromApi,
    created,
    updated,
    linked,
  };
}

/**
 * 2026(시즌) 오늘 이전 날짜 — DB에 없으면 api-sports(캐시 우선)로 Match 등록, 있으면 패스
 */
export async function backfillSeasonMatchesBeforeToday(season?: number): Promise<{
  season: number;
  daysSkipped: number;
  daysFilled: number;
  daysEmpty: number;
  created: number;
}> {
  const targetSeason = season ?? currentSeasonYear();
  const today = getKstDateString();
  let cursor = seasonRangeStart(targetSeason);

  let daysSkipped = 0;
  let daysFilled = 0;
  let daysEmpty = 0;
  let created = 0;

  while (cursor < today) {
    const existingCount = await MatchModel.countDocuments({
      matchDate: cursor,
      apiSportsGameId: { $ne: null },
    });

    const staleCount =
      existingCount > 0
        ? await MatchModel.countDocuments({
            matchDate: cursor,
            apiSportsGameId: { $ne: null },
            matchStatus: { $in: ["scheduled", "ongoing"] },
          })
        : 0;

    if (existingCount > 0 && staleCount === 0) {
      daysSkipped += 1;
      cursor = addKstDays(cursor, 1);
      continue;
    }

    let result = await syncTodayGamesFromApiSports(cursor, {
      forceApi: staleCount > 0 || existingCount === 0,
      skipExisting: false,
    });

    if (result.games.length === 0) {
      result = await syncTodayGamesFromApiSports(cursor, {
        forceApi: true,
        skipExisting: false,
      });
    }

    if (result.games.length === 0) {
      daysEmpty += 1;
    } else {
      daysFilled += 1;
      created += result.created;
    }

    cursor = addKstDays(cursor, 1);
  }

  console.log(
    `[MatchMgmtSchedule] backfill ${targetSeason} before ${today}: skip ${daysSkipped}, fill ${daysFilled}, empty ${daysEmpty}, created ${created}`,
  );

  return { season: targetSeason, daysSkipped, daysFilled, daysEmpty, created };
}

/** 최근 N일 — scheduled/ongoing으로 남은 과거 경기 스코어·상태 API 갱신 */
export async function refreshStalePastMatchScores(lookbackDays = 14): Promise<{
  daysRefreshed: number;
  updated: number;
}> {
  const today = getKstDateString();
  let daysRefreshed = 0;
  let updated = 0;

  for (let i = 1; i <= lookbackDays; i++) {
    const date = addKstDays(today, -i);
    const staleCount = await MatchModel.countDocuments({
      matchDate: date,
      apiSportsGameId: { $ne: null },
      matchStatus: { $in: ["scheduled", "ongoing"] },
    });
    if (staleCount === 0) continue;

    const result = await syncTodayGamesFromApiSports(date, { forceApi: true });
    daysRefreshed += 1;
    updated += result.updated;
    console.log(
      `[MatchMgmtSchedule] stale refresh ${date}: updated ${result.updated}, linked ${result.linked}`,
    );
  }

  return { daysRefreshed, updated };
}

async function updateMatchStatusFromApiGame(
  match: {
    id: string;
    matchStatus?: string;
    startTime?: Date | null;
    liveScoreboard?: LiveScoreboard | null;
    controlMode?: string | null;
  },
  game: ApiSportsGameResponse,
): Promise<string> {
  const incoming = parseLiveScoreboard(game);
  const scoreboard = resolveScoreboardForApiWrite(match, incoming);
  const previousStatus = match.matchStatus ?? "scheduled";
  const nextStatus = resolveMatchStatusFromScoreboard(previousStatus, incoming, match.startTime);

  await MatchModel.updateOne(
    { id: match.id },
    {
      matchStatus: nextStatus,
      // 상태만 갱신해도 점수·이닝은 반드시 포함 (부분 merge 시 총점이 비는 문제 방지)
      // 단, 라이브 중·수동 모드에서는 기존 점수/이닝 표를 유지
      liveScoreboard: scoreboard,
      ...apiSportsTeamsUpdate(game, incoming),
      lastInningKey: buildInningKey(scoreboard),
    },
  );

  await syncOperatorAccountForMatch(match.id);
  return nextStatus;
}

async function updateMatchScoreFromApiGame(
  match: {
    id: string;
    matchStatus?: string;
    sideBetsLocked?: boolean;
    predictionEnabled?: boolean;
    startTime?: Date | null;
    liveScoreboard?: LiveScoreboard | null;
    controlMode?: string | null;
  },
  game: ApiSportsGameResponse,
): Promise<string> {
  const incoming = parseLiveScoreboard(game);
  const scoreboard = resolveScoreboardForApiWrite(match, incoming);
  const nextStatus = resolveMatchStatusFromScoreboard(
    match.matchStatus ?? "scheduled",
    incoming,
    match.startTime,
  );

  await MatchModel.updateOne(
    { id: match.id },
    {
      matchStatus: nextStatus,
      liveScoreboard: scoreboard,
      ...apiSportsTeamsUpdate(game, incoming),
      lastInningKey: buildInningKey(scoreboard),
      sideBetsLocked: resolveSideBetsLocked({
        previouslyLocked: match.sideBetsLocked,
        predictionEnabled: match.predictionEnabled,
        matchStatus: nextStatus,
        statusShort: incoming.statusShort,
        inning: incoming.inning,
        startTime: match.startTime,
      }),
    },
  );

  await syncOperatorAccountForMatch(match.id);
  return nextStatus;
}

/** ② 경기 시작 시각 — api-sports 1회 → 경기상태만 (운영자 API 폴링 ON일 때만) */
export async function refreshMatchFromApiAtStart(matchId: string): Promise<void> {
  if (!process.env.API_SPORTS_KEY?.trim()) return;

  const match = await MatchModel.findOne({ id: matchId }).lean();
  if (!match?.apiSportsGameId) return;
  if (match.matchStatus === "completed" || match.matchStatus === "cancelled") return;

  const order = match.registrationOrder ?? 0;
  if (order >= 1 && order <= MAX_DAILY_MATCHES && !(await isApiSyncEnabledForRegistrationOrder(order))) {
    return;
  }

  try {
    const game = await fetchGameById(match.apiSportsGameId);
    if (!game) return;

    const nextStatus = await updateMatchStatusFromApiGame(match, game);
    console.log(`[MatchMgmtSchedule] start ${match.name} (${matchId}) → ${nextStatus}`);

    await refreshMatchLineupIfDue(
      matchId,
      {
        id: matchId,
        registrationOrder: match.registrationOrder,
        apiSportsGameId: match.apiSportsGameId,
        startTime: match.startTime,
        gameInning: match.gameInning,
        inningHalf: match.inningHalf,
        batterIndexInHalf: match.batterIndexInHalf,
        matchLineup: match.matchLineup as MatchLineupSnapshot | null | undefined,
        matchPlayerStats: match.matchPlayerStats as Record<string, MatchPlayerStatsEntry> | null | undefined,
      },
      [game.teams.home.id, game.teams.away.id].filter((id) => Number.isFinite(id) && id > 0),
    );

    await refreshMatchHeadToHeadIfDue(matchId, {
      id: matchId,
      registrationOrder: match.registrationOrder,
      startTime: match.startTime,
      apiSportsAwayTeamId: game.teams.away.id,
      apiSportsHomeTeamId: game.teams.home.id,
      matchHeadToHead: match.matchHeadToHead as MatchHeadToHeadSnapshot | null | undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    markApiSportsError(message);
    throw error;
  }
}

/** ③ 경기 종료 시각 — api-sports 1회 → 스코어만 갱신 (운영자 API 폴링 ON일 때만) */
export async function refreshMatchFromApiAtEnd(matchId: string): Promise<void> {
  if (!process.env.API_SPORTS_KEY?.trim()) return;

  const match = await MatchModel.findOne({ id: matchId }).lean();
  if (!match?.apiSportsGameId) return;
  if (match.matchStatus === "completed" || match.matchStatus === "cancelled") return;

  const order = match.registrationOrder ?? 0;
  if (order >= 1 && order <= MAX_DAILY_MATCHES && !(await isApiSyncEnabledForRegistrationOrder(order))) {
    return;
  }

  try {
    const game = await fetchGameById(match.apiSportsGameId);
    if (!game) return;

    const previousStatus = match.matchStatus ?? "scheduled";
    const nextStatus = await updateMatchScoreFromApiGame(match, game);

    if (nextStatus === "completed" && previousStatus !== "completed") {
      if (match.predictionEnabled) {
        console.log(
          `[MatchMgmtSchedule] defer end complete ${match.name} (${matchId}) — prediction still open`,
        );
        return;
      }
      const openRound = await RoundStatisticsModel.findOne({
        matchId,
        roundNumber: match.currentRound,
        isPredictionStarted: true,
        isResultSent: false,
      })
        .select("id")
        .lean();
      if (openRound) {
        console.log(
          `[MatchMgmtSchedule] defer end complete ${match.name} (${matchId}) — round result not sent`,
        );
        return;
      }
      const { match: ended } = await finalizeMatchEnd(matchId);
      broadcastManager.sendToMatch(matchId, "end", {
        matchId,
        message: "경기가 종료되었습니다.",
        matchStatus: ended.matchStatus,
      });
      console.log(`[MatchMgmtSchedule] end ${ended.name} (${matchId}) → completed (score updated)`);
      return;
    }

    console.log(`[MatchMgmtSchedule] end ${match.name} (${matchId}) → score updated (${nextStatus})`);

    await refreshMatchHeadToHeadIfDue(matchId, {
      id: matchId,
      registrationOrder: match.registrationOrder,
      startTime: match.startTime,
      apiSportsAwayTeamId: game.teams.away.id,
      apiSportsHomeTeamId: game.teams.home.id,
      matchHeadToHead: match.matchHeadToHead as MatchHeadToHeadSnapshot | null | undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    markApiSportsError(message);
    throw error;
  }
}

function isWithinLiveSyncWindow(startTime?: Date | null, nowMs = Date.now()): boolean {
  if (!startTime) return false;
  const startMs = new Date(startTime).getTime();
  if (!Number.isFinite(startMs)) return false;
  return nowMs >= startMs - LIVE_SCORE_SYNC_START_BEFORE_MS;
}

/** live sync 창(시작 1분 전~) 안에서만 — 진행 중 2.5초, NS·scheduled는 60초 간격 시작 감지 */
function shouldFetchLiveScoreFromApi(
  match: {
    matchStatus?: string | null;
    startTime?: Date | null;
    liveScoreboard?: { statusShort?: string | null; syncedAt?: string | null } | null;
  },
  nowMs = Date.now(),
): boolean {
  if (!isWithinLiveSyncWindow(match.startTime, nowMs)) return false;

  if (match.matchStatus === "ongoing") return true;
  if (isGameLiveStatus(match.liveScoreboard?.statusShort)) return true;

  if (
    match.matchStatus === "scheduled" &&
    isGameNotStarted(match.liveScoreboard?.statusShort)
  ) {
    const syncedAt = match.liveScoreboard?.syncedAt;
    if (!syncedAt) return true;
    return nowMs - new Date(syncedAt).getTime() >= LIVE_SCORE_NS_GATE_POLL_MS;
  }

  return true;
}

/**
 * live sync — api-sports → Match DB 스코어보드
 * 해당 registrationOrder 슬롯 운영자 API 폴링 ON일 때만 호출
 * @returns true면 live sync 중단(종료·취소·API OFF·대상 아님)
 */
export async function refreshMatchLiveScoreFromApi(matchId: string): Promise<boolean> {
  if (!process.env.API_SPORTS_KEY?.trim()) return true;

  const match = await MatchModel.findOne({ id: matchId }).lean();
  if (!match?.apiSportsGameId) return true;
  if (match.matchStatus === "completed" || match.matchStatus === "cancelled") return true;

  const order = match.registrationOrder ?? 99;
  if (order < 1 || order > 5) return true;

  const apiSyncEnabled = await isApiSyncEnabledForRegistrationOrder(order);
  if (!apiSyncEnabled) {
    console.log(
      `[LiveScoreSync] tick skipped ${matchId} (order=${order}) — 운영자 API 폴링 OFF`,
    );
    return true;
  }

  if (!shouldFetchLiveScoreFromApi(match)) {
    return false;
  }

  try {
    const game = await fetchGameById(match.apiSportsGameId);
    if (!game) return false;

    const incoming = parseLiveScoreboard(game);
    const scoreboard = resolveScoreboardForApiWrite(
      {
        controlMode: (match as { controlMode?: string | null }).controlMode,
        matchStatus: match.matchStatus,
        liveScoreboard: match.liveScoreboard as LiveScoreboard | null | undefined,
      },
      incoming,
    );
    const previousStatus = match.matchStatus ?? "scheduled";
    const nextStatus = resolveMatchStatusFromScoreboard(previousStatus, incoming, match.startTime);
    const apiNotStarted = isGameNotStarted(incoming.statusShort);

    await MatchModel.updateOne(
      { id: matchId },
      {
        matchStatus: nextStatus,
        liveScoreboard: scoreboard,
        ...apiSportsTeamsUpdate(game, incoming),
        lastInningKey: buildInningKey(scoreboard),
        sideBetsLocked: resolveSideBetsLocked({
          previouslyLocked: match.sideBetsLocked,
          predictionEnabled: match.predictionEnabled,
          matchStatus: nextStatus,
          statusShort: incoming.statusShort,
          inning: incoming.inning,
          startTime: match.startTime,
        }),
      },
    );

    await syncOperatorAccountForMatch(matchId);

    if (apiNotStarted && nextStatus === "scheduled") {
      return false;
    }

    void refreshMatchLineupIfDue(
      matchId,
      {
        id: matchId,
        registrationOrder: match.registrationOrder,
        apiSportsGameId: match.apiSportsGameId,
        startTime: match.startTime,
        gameInning: match.gameInning,
        inningHalf: match.inningHalf,
        batterIndexInHalf: match.batterIndexInHalf,
        matchLineup: match.matchLineup as MatchLineupSnapshot | null | undefined,
        matchPlayerStats: match.matchPlayerStats as Record<string, MatchPlayerStatsEntry> | null | undefined,
      },
      [game.teams.home.id, game.teams.away.id].filter((id) => Number.isFinite(id) && id > 0),
    ).catch((err) => {
      console.warn(`[LiveScoreSync] lineup refresh ${matchId}:`, err);
    });

    void refreshMatchHeadToHeadIfDue(matchId, {
      id: matchId,
      registrationOrder: match.registrationOrder,
      startTime: match.startTime,
      apiSportsAwayTeamId: game.teams.away.id,
      apiSportsHomeTeamId: game.teams.home.id,
      matchHeadToHead: match.matchHeadToHead as MatchHeadToHeadSnapshot | null,
    }).catch((err) => {
      console.warn(`[LiveScoreSync] h2h refresh ${matchId}:`, err);
    });

    if (nextStatus === "completed" && previousStatus !== "completed") {
      // 운영자 예측 라운드가 열려 있으면 종료를 미룸 (점수만 갱신된 상태 유지)
      if (match.predictionEnabled) {
        console.log(
          `[LiveScoreSync] defer complete ${match.name} (${matchId}) — prediction still open`,
        );
        return false;
      }
      const openRound = await RoundStatisticsModel.findOne({
        matchId,
        roundNumber: match.currentRound,
        isPredictionStarted: true,
        isResultSent: false,
      })
        .select("id")
        .lean();
      if (openRound) {
        console.log(
          `[LiveScoreSync] defer complete ${match.name} (${matchId}) — round result not sent`,
        );
        return false;
      }

      const { match: ended } = await finalizeMatchEnd(matchId);
      broadcastManager.sendToMatch(matchId, "end", {
        matchId,
        message: "경기가 종료되었습니다.",
        matchStatus: ended.matchStatus,
      });
      console.log(`[LiveScoreSync] ${ended.name} (${matchId}) → completed`);
      return true;
    }

    if (nextStatus === "cancelled" || isGamePostponedOrCancelled(scoreboard.statusShort)) {
      console.log(`[LiveScoreSync] ${match.name} (${matchId}) → cancelled/postponed`);
      return true;
    }

    if (isGameFinished(scoreboard.statusShort)) return true;
    return false;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    markApiSportsError(message);
    throw error;
  }
}

export async function setMatchControlMode(matchId: string, mode: MatchControlMode) {
  const updated = await MatchModel.findOneAndUpdate(
    { id: matchId },
    { controlMode: mode },
    { new: true },
  ).lean();
  if (!updated) throw new Error("경기를 찾을 수 없습니다.");

  // auto 복귀 시 즉시 1회 동기화 시도 (ongoing 이면 점수 보존 정책은 그대로 적용)
  if (mode === "auto" && updated.apiSportsGameId) {
    try {
      await refreshMatchLiveScoreFromApi(matchId);
    } catch (err) {
      console.warn(`[ControlMode] auto refresh ${matchId}:`, err);
    }
  }

  return await MatchModel.findOne({ id: matchId }).lean() ?? updated;
}

export type LiveScoreboardPatchInput = {
  homeScore?: number;
  awayScore?: number;
  homeHits?: number;
  awayHits?: number;
  homeErrors?: number;
  awayErrors?: number;
  homeInnings?: InningRunsMap;
  awayInnings?: InningRunsMap;
  inning?: number | null;
  inningHalf?: InningHalf | null;
  /** 기본 true — 보정 후 API가 점수를 다시 덮지 않도록 수동 잠금 */
  lockManual?: boolean;
  /** true면 운영자 gameInning/inningHalf 도 함께 맞춤 */
  syncOperatorPhase?: boolean;
};

/**
 * 운영자/관리자 스코어보드 수동 보정.
 * 기본적으로 controlMode=manual 로 잠가 이후 API 덮어쓰기를 막음.
 */
export async function patchMatchLiveScoreboard(matchId: string, patch: LiveScoreboardPatchInput) {
  const match = await MatchModel.findOne({ id: matchId }).lean();
  if (!match) throw new Error("경기를 찾을 수 없습니다.");

  const existing = (match.liveScoreboard as LiveScoreboard | null | undefined) ?? null;
  const awayName =
    existing?.awayTeamName ||
    (match as { apiSportsAwayTeam?: string }).apiSportsAwayTeam ||
    "원정팀";
  const homeName =
    existing?.homeTeamName ||
    (match as { apiSportsHomeTeam?: string }).apiSportsHomeTeam ||
    "홈팀";

  const nextInning =
    patch.inning !== undefined
      ? patch.inning
      : (existing?.inning ?? (match as { gameInning?: number }).gameInning ?? null);
  const nextHalfRaw =
    patch.inningHalf !== undefined
      ? patch.inningHalf
      : (existing?.inningHalf ?? (match as { inningHalf?: string }).inningHalf ?? null);
  const nextHalf = nextHalfRaw ? parseInningHalf(nextHalfRaw) : null;

  const merged: LiveScoreboard = {
    homeTeamName: homeName,
    awayTeamName: awayName,
    homeTeamLogo:
      existing?.homeTeamLogo ??
      (match as { apiSportsHomeTeamLogo?: string | null }).apiSportsHomeTeamLogo ??
      null,
    awayTeamLogo:
      existing?.awayTeamLogo ??
      (match as { apiSportsAwayTeamLogo?: string | null }).apiSportsAwayTeamLogo ??
      null,
    homeScore: patch.homeScore ?? existing?.homeScore ?? 0,
    awayScore: patch.awayScore ?? existing?.awayScore ?? 0,
    homeHits: patch.homeHits ?? existing?.homeHits ?? 0,
    awayHits: patch.awayHits ?? existing?.awayHits ?? 0,
    homeErrors: patch.homeErrors ?? existing?.homeErrors ?? 0,
    awayErrors: patch.awayErrors ?? existing?.awayErrors ?? 0,
    homeInnings: patch.homeInnings ?? existing?.homeInnings,
    awayInnings: patch.awayInnings ?? existing?.awayInnings,
    inning: nextInning,
    inningHalf: nextHalf,
    inningLabel:
      nextInning != null && nextHalf
        ? formatInningWithHalf(nextInning, nextHalf)
        : (existing?.inningLabel ?? ""),
    statusShort: existing?.statusShort ?? "IN",
    statusLong: existing?.statusLong ?? "In Progress",
    syncedAt: new Date().toISOString(),
  };

  const lockManual = patch.lockManual !== false;
  const update: Record<string, unknown> = {
    liveScoreboard: merged,
    lastInningKey: buildInningKey(merged),
  };
  if (lockManual) {
    update.controlMode = "manual" satisfies MatchControlMode;
  }
  if (patch.syncOperatorPhase && nextInning != null && nextHalf) {
    update.gameInning = nextInning;
    update.inningHalf = nextHalf;
  }

  const updated = await MatchModel.findOneAndUpdate({ id: matchId }, update, { new: true }).lean();
  if (!updated) throw new Error("경기를 찾을 수 없습니다.");
  return updated;
}

export async function linkMatchToApiSports(matchId: string, apiSportsGameId: number) {
  const game = await fetchGameById(apiSportsGameId);
  if (!game) throw new Error("API-SPORTS 경기를 찾을 수 없습니다.");

  const scoreboard = parseLiveScoreboard(game);
  const updated = await MatchModel.findOneAndUpdate(
    { id: matchId },
    {
      apiSportsGameId,
      ...apiSportsTeamsUpdate(game, scoreboard),
      liveScoreboard: scoreboard,
      lastInningKey: buildInningKey(scoreboard),
    },
    { new: true },
  ).lean();

  if (!updated) throw new Error("경기를 찾을 수 없습니다.");

  await refreshMatchHeadToHeadIfDue(matchId, {
    id: matchId,
    registrationOrder: (updated as { registrationOrder?: number | null }).registrationOrder,
    startTime: updated.startTime,
    apiSportsAwayTeamId: game.teams.away.id,
    apiSportsHomeTeamId: game.teams.home.id,
    matchHeadToHead: updated.matchHeadToHead as MatchHeadToHeadSnapshot | null | undefined,
  });

  return updated;
}
