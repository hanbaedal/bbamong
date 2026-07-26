import { randomUUID } from "crypto";
import { MatchModel, StadiumModel, getNextSequence } from "../UserStorage/db";
import { finalizeMatchEnd } from "../liveMatch/sideBetStorage";
import { addKstDays, getKstDateString } from "../utils/dateUtils";
import { fetchGameById, type ApiSportsGameResponse } from "./client";
import { markApiSportsError } from "./healthState";
import type { ApiSportsTodayGame, LiveScoreboard } from "@shared/apiSportsTypes";
import {
  buildInningKey,
  isGameFinished,
  isGameLiveStatus,
  parseLiveScoreboard,
} from "./scoreboardParser";
import { getScheduleGamesForDate, importSeasonScheduleToCache } from "./scheduleCache";
import { LIVE_SCORE_MAX_REGISTRATION_ORDER } from "./constants";

const MAX_DAILY_MATCHES = 5;
const API_DEFAULT_STADIUM_NAME = "API자동";

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
  if (isGameFinished(short)) return "completed";
  if (short === "CAN" || short === "PST" || short === "ABD" || short === "SUSP") return "cancelled";
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
  if (currentStatus === "completed" || currentStatus === "cancelled") {
    return currentStatus;
  }
  if (isGameFinished(scoreboard.statusShort)) {
    return "completed";
  }
  if (isGameLiveStatus(scoreboard.statusShort) || scoreboard.inning !== null) {
    return "ongoing";
  }
  if (hasStartTimeReached(startTime)) {
    const totalRuns = (scoreboard.homeScore ?? 0) + (scoreboard.awayScore ?? 0);
    if (totalRuns > 0) return "ongoing";
  }
  return currentStatus === "ongoing" ? "ongoing" : "scheduled";
}

async function ensureStadiumByName(name: string): Promise<number> {
  const trimmed = name.trim() || API_DEFAULT_STADIUM_NAME;
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

function venueNameFromGame(game: ApiSportsGameResponse): string {
  const name = game.venue?.name?.trim();
  if (name) return name;
  return API_DEFAULT_STADIUM_NAME;
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
  games: ApiSportsTodayGame[];
  source: "cache" | "api";
}> {
  const targetDate = date ?? getKstDateString();
  const { games: apiGames, source } = await getScheduleGamesForDate(targetDate, {
    forceApi: options?.forceApi,
  });

  const sortedApi = apiGames
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, MAX_DAILY_MATCHES);
  const mapped = mapTodayGames(sortedApi);

  if (sortedApi.length === 0) {
    return { created: 0, updated: 0, linked: 0, games: [], source };
  }

  const today = new Date(`${targetDate}T12:00:00`);
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const internalMatches = await MatchModel.find({
    $or: [{ matchDate: targetDate }, { matchDate: null, startTime: { $gte: startOfDay, $lte: endOfDay } }],
  }).lean();

  const byApiId = new Map(
    internalMatches
      .filter((m) => m.apiSportsGameId != null)
      .map((m) => [m.apiSportsGameId as number, m]),
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

    const existing =
      byApiId.get(external.id) ??
      byName.get(matchName) ??
      null;

    if (options?.skipExisting && existing?.apiSportsGameId === external.id) {
      linked += 1;
      continue;
    }

    const payload = {
      name: matchName,
      stadiumId,
      matchDate: targetDate,
      startTime,
      endTime,
      matchStatus: existing?.matchStatus === "completed" ? "completed" : matchStatus,
      registrationOrder: i + 1,
      apiSportsGameId: external.id,
      apiSportsHomeTeam: scoreboard.homeTeamName,
      apiSportsAwayTeam: scoreboard.awayTeamName,
      liveScoreboard:
        options?.forceApi
          ? scoreboard
          : existing?.liveScoreboard && existing.matchStatus === "ongoing"
            ? existing.liveScoreboard
            : scoreboard,
      lastInningKey: existing?.lastInningKey ?? buildInningKey(scoreboard),
      controlMode: existing?.controlMode ?? "auto",
      sideBetsLocked:
        existing?.sideBetsLocked ||
        scoreboard.inning !== null ||
        isGameFinished(scoreboard.statusShort),
    };

    if (existing) {
      await MatchModel.updateOne({ id: existing.id }, payload);
      updated += 1;
      linked += 1;
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

  return { created, updated, linked, games: mapped, source };
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

    if (existingCount > 0) {
      daysSkipped += 1;
      cursor = addKstDays(cursor, 1);
      continue;
    }

    let result = await syncTodayGamesFromApiSports(cursor, {
      forceApi: false,
      skipExisting: true,
    });

    if (result.games.length === 0) {
      result = await syncTodayGamesFromApiSports(cursor, {
        forceApi: true,
        skipExisting: true,
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

async function updateMatchStatusFromApiGame(
  match: {
    id: string;
    matchStatus?: string;
    startTime?: Date | null;
    liveScoreboard?: LiveScoreboard | null;
  },
  game: ApiSportsGameResponse,
): Promise<string> {
  const scoreboard = parseLiveScoreboard(game);
  const previousStatus = match.matchStatus ?? "scheduled";
  const nextStatus = resolveMatchStatusFromScoreboard(previousStatus, scoreboard, match.startTime);
  const prevBoard = (match.liveScoreboard ?? {}) as LiveScoreboard;

  await MatchModel.updateOne(
    { id: match.id },
    {
      matchStatus: nextStatus,
      liveScoreboard: {
        ...prevBoard,
        statusShort: scoreboard.statusShort,
        statusLong: scoreboard.statusLong,
        inningLabel: scoreboard.inningLabel,
        syncedAt: scoreboard.syncedAt,
      },
    },
  );

  return nextStatus;
}

async function updateMatchScoreFromApiGame(
  match: { id: string; matchStatus?: string; sideBetsLocked?: boolean },
  game: ApiSportsGameResponse,
): Promise<string> {
  const scoreboard = parseLiveScoreboard(game);
  const nextStatus = isGameFinished(scoreboard.statusShort) ? "completed" : (match.matchStatus ?? "ongoing");

  await MatchModel.updateOne(
    { id: match.id },
    {
      matchStatus: nextStatus,
      liveScoreboard: scoreboard,
      apiSportsHomeTeam: scoreboard.homeTeamName,
      apiSportsAwayTeam: scoreboard.awayTeamName,
      lastInningKey: buildInningKey(scoreboard),
      sideBetsLocked:
        match.sideBetsLocked ||
        scoreboard.inning !== null ||
        isGameFinished(scoreboard.statusShort),
    },
  );

  return nextStatus;
}

/** ② 경기 시작 시각 — api-sports 1회 → 경기상태만 */
export async function refreshMatchFromApiAtStart(matchId: string): Promise<void> {
  if (!process.env.API_SPORTS_KEY?.trim()) return;

  const match = await MatchModel.findOne({ id: matchId }).lean();
  if (!match?.apiSportsGameId) return;
  if (match.matchStatus === "completed" || match.matchStatus === "cancelled") return;

  try {
    const game = await fetchGameById(match.apiSportsGameId);
    if (!game) return;

    const nextStatus = await updateMatchStatusFromApiGame(match, game);
    console.log(`[MatchMgmtSchedule] start ${match.name} (${matchId}) → ${nextStatus}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    markApiSportsError(message);
    throw error;
  }
}

/** ③ 경기 종료 시각 — api-sports 1회 → 스코어만 갱신 */
export async function refreshMatchFromApiAtEnd(matchId: string): Promise<void> {
  if (!process.env.API_SPORTS_KEY?.trim()) return;

  const match = await MatchModel.findOne({ id: matchId }).lean();
  if (!match?.apiSportsGameId) return;
  if (match.matchStatus === "completed" || match.matchStatus === "cancelled") return;

  try {
    const game = await fetchGameById(match.apiSportsGameId);
    if (!game) return;

    const previousStatus = match.matchStatus ?? "scheduled";
    const nextStatus = await updateMatchScoreFromApiGame(match, game);

    if (nextStatus === "completed" && previousStatus !== "completed") {
      await finalizeMatchEnd(matchId);
      console.log(`[MatchMgmtSchedule] end ${match.name} (${matchId}) → completed (score updated)`);
      return;
    }

    console.log(`[MatchMgmtSchedule] end ${match.name} (${matchId}) → score updated (${nextStatus})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    markApiSportsError(message);
    throw error;
  }
}

/**
 * 1경기(registrationOrder≤LIVE_SCORE_MAX) live sync — api-sports → Match DB 전체 스코어보드
 * @returns true면 live sync 중단(종료·취소·대상 아님)
 */
export async function refreshMatchLiveScoreFromApi(matchId: string): Promise<boolean> {
  if (!process.env.API_SPORTS_KEY?.trim()) return true;

  const match = await MatchModel.findOne({ id: matchId }).lean();
  if (!match?.apiSportsGameId) return true;
  if (match.matchStatus === "completed" || match.matchStatus === "cancelled") return true;

  const order = match.registrationOrder ?? 99;
  if (order > LIVE_SCORE_MAX_REGISTRATION_ORDER) return true;

  try {
    const game = await fetchGameById(match.apiSportsGameId);
    if (!game) return false;

    const scoreboard = parseLiveScoreboard(game);
    const previousStatus = match.matchStatus ?? "scheduled";
    const nextStatus = resolveMatchStatusFromScoreboard(previousStatus, scoreboard, match.startTime);

    await MatchModel.updateOne(
      { id: matchId },
      {
        matchStatus: nextStatus,
        liveScoreboard: scoreboard,
        apiSportsHomeTeam: scoreboard.homeTeamName,
        apiSportsAwayTeam: scoreboard.awayTeamName,
        lastInningKey: buildInningKey(scoreboard),
        sideBetsLocked:
          match.sideBetsLocked ||
          scoreboard.inning !== null ||
          isGameFinished(scoreboard.statusShort),
      },
    );

    if (nextStatus === "completed" && previousStatus !== "completed") {
      await finalizeMatchEnd(matchId);
      console.log(`[LiveScoreSync] ${match.name} (${matchId}) → completed`);
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

export async function setMatchControlMode(matchId: string, mode: "auto" | "manual") {
  const updated = await MatchModel.findOneAndUpdate(
    { id: matchId },
    { controlMode: mode },
    { new: true },
  ).lean();
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
      apiSportsHomeTeam: scoreboard.homeTeamName,
      apiSportsAwayTeam: scoreboard.awayTeamName,
      liveScoreboard: scoreboard,
      lastInningKey: buildInningKey(scoreboard),
    },
    { new: true },
  ).lean();

  if (!updated) throw new Error("경기를 찾을 수 없습니다.");
  return updated;
}
