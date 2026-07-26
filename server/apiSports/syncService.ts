import { randomUUID } from "crypto";
import { MatchModel, StadiumModel, getNextSequence } from "../UserStorage/db";
import { finalizeMatchEnd } from "../liveMatch/sideBetStorage";
import { getKstDateString } from "../utils/dateUtils";
import { fetchGameById, type ApiSportsGameResponse } from "./client";
import { markApiSportsError } from "./healthState";
import type { ApiSportsTodayGame, LiveScoreboard } from "@shared/apiSportsTypes";
import {
  buildInningKey,
  isGameFinished,
  isGameLiveStatus,
  parseLiveScoreboard,
} from "./scoreboardParser";
import { getScheduleGamesForDate } from "./scheduleCache";

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
  options?: { forceApi?: boolean },
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

async function updateMatchFromApiGame(
  match: {
    id: string;
    matchStatus?: string;
    startTime?: Date | null;
    sideBetsLocked?: boolean;
  },
  game: ApiSportsGameResponse,
): Promise<string> {
  const scoreboard = parseLiveScoreboard(game);
  const previousStatus = match.matchStatus ?? "scheduled";
  const nextStatus = resolveMatchStatusFromScoreboard(previousStatus, scoreboard, match.startTime);

  await MatchModel.updateOne(
    { id: match.id },
    {
      liveScoreboard: scoreboard,
      apiSportsHomeTeam: scoreboard.homeTeamName,
      apiSportsAwayTeam: scoreboard.awayTeamName,
      lastInningKey: buildInningKey(scoreboard),
      matchStatus: nextStatus,
      sideBetsLocked:
        match.sideBetsLocked ||
        scoreboard.inning !== null ||
        isGameFinished(scoreboard.statusShort),
    },
  );

  return nextStatus;
}

/** ② 경기 시작 시각 — api-sports 1회 → 상태(취소·연기·진행 등) */
export async function refreshMatchFromApiAtStart(matchId: string): Promise<void> {
  if (!process.env.API_SPORTS_KEY?.trim()) return;

  const match = await MatchModel.findOne({ id: matchId }).lean();
  if (!match?.apiSportsGameId) return;
  if (match.matchStatus === "completed" || match.matchStatus === "cancelled") return;

  try {
    const game = await fetchGameById(match.apiSportsGameId);
    if (!game) return;

    const nextStatus = await updateMatchFromApiGame(match, game);
    console.log(`[MatchMgmtSchedule] start ${match.name} (${matchId}) → ${nextStatus}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    markApiSportsError(message);
    throw error;
  }
}

/** ③ 경기 종료 시각 — api-sports 1회 → 최종 스코어·completed */
export async function refreshMatchFromApiAtEnd(matchId: string): Promise<void> {
  if (!process.env.API_SPORTS_KEY?.trim()) return;

  const match = await MatchModel.findOne({ id: matchId }).lean();
  if (!match?.apiSportsGameId) return;
  if (match.matchStatus === "completed" || match.matchStatus === "cancelled") return;

  try {
    const game = await fetchGameById(match.apiSportsGameId);
    if (!game) return;

    const previousStatus = match.matchStatus ?? "scheduled";
    const nextStatus = await updateMatchFromApiGame(match, game);

    if (nextStatus === "completed" && previousStatus !== "completed") {
      await finalizeMatchEnd(matchId);
      console.log(`[MatchMgmtSchedule] end ${match.name} (${matchId}) → completed`);
      return;
    }

    console.log(`[MatchMgmtSchedule] end ${match.name} (${matchId}) → ${nextStatus}`);
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
