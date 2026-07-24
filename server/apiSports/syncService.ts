import { randomUUID } from "crypto";
import { MatchModel, StadiumModel, getNextSequence } from "../UserStorage/db";
import { broadcastManager } from "../liveMatch/broadcastManager";
import { finalizeMatchEnd, lockSideBetsForMatch } from "../liveMatch/sideBetStorage";
import { getKstDateString } from "../utils/dateUtils";
import { fetchGameById, fetchGamesByDate, type ApiSportsGameResponse } from "./client";
import { KBO_LEAGUE_ID } from "./constants";
import { markApiSportsError } from "./healthState";
import {
  buildInningKey,
  isGameFinished,
  parseLiveScoreboard,
} from "./scoreboardParser";
import type { ApiSportsTodayGame } from "@shared/apiSportsTypes";

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
  if (short === "NS" || short === "TBD") return "scheduled";
  return "ongoing";
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
export async function syncTodayGamesFromApiSports(date?: string): Promise<{
  created: number;
  updated: number;
  linked: number;
  games: ApiSportsTodayGame[];
}> {
  const targetDate = date ?? getKstDateString();
  const apiGames = await fetchGamesByDate(targetDate, KBO_LEAGUE_ID);
  const sortedApi = apiGames
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, MAX_DAILY_MATCHES);
  const mapped = mapTodayGames(sortedApi);

  if (sortedApi.length === 0) {
    return { created: 0, updated: 0, linked: 0, games: [] };
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
      liveScoreboard: scoreboard,
      lastInningKey: buildInningKey(scoreboard),
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

  return { created, updated, linked, games: mapped };
}

async function handleInningChange(matchId: string, scoreboard: ReturnType<typeof parseLiveScoreboard>) {
  broadcastManager.sendToMatch(matchId, "inning_change", {
    matchId,
    scoreboard,
    message: "이닝 변경이 감지되었습니다.",
  });

  broadcastManager.scheduleAdStart(matchId, 0);
  broadcastManager.sendToMatch(matchId, "rewarded_ad_offer", {
    matchId,
    rewardPoints: 500,
    rewardKey: buildInningKey(scoreboard),
    dismissGraceSeconds: 5,
    message: "공수교대 광고를 시청하면 500포인트를 받을 수 있습니다.",
  });
}

async function syncLinkedMatch(match: any) {
  if (!match.apiSportsGameId) return;

  const game = await fetchGameById(match.apiSportsGameId);
  if (!game) return;

  const scoreboard = parseLiveScoreboard(game);
  const inningKey = buildInningKey(scoreboard);
  const previousKey = match.lastInningKey as string | null | undefined;
  const controlMode = match.controlMode ?? "auto";

  await MatchModel.updateOne(
    { id: match.id },
    {
      liveScoreboard: scoreboard,
      apiSportsHomeTeam: scoreboard.homeTeamName,
      apiSportsAwayTeam: scoreboard.awayTeamName,
      lastInningKey: inningKey,
      matchStatus:
        isGameFinished(scoreboard.statusShort) && match.matchStatus !== "completed"
          ? "completed"
          : match.matchStatus === "scheduled" && scoreboard.inning !== null
            ? "ongoing"
            : match.matchStatus,
    },
  );

  if (scoreboard.inning !== null && !match.sideBetsLocked) {
    const locked = await lockSideBetsForMatch(match.id);
    if (locked) {
      broadcastManager.sendToMatch(match.id, "side_bets_locked", {
        matchId: match.id,
        message: "1회 시작으로 승리팀·스코어 배팅이 마감되었습니다.",
      });
    }
  }

  broadcastManager.sendToMatch(match.id, "scoreboard_update", {
    matchId: match.id,
    scoreboard,
  });

  if (
    controlMode === "auto" &&
    previousKey &&
    previousKey !== inningKey &&
    scoreboard.inning !== null
  ) {
    await handleInningChange(match.id, scoreboard);
  }

  if (controlMode === "auto" && isGameFinished(scoreboard.statusShort) && match.matchStatus !== "completed") {
    const { match: ended } = await finalizeMatchEnd(match.id);
    broadcastManager.sendToMatch(match.id, "match_ended", {
      matchId: match.id,
      message: "API-SPORTS 기준 경기가 종료되었습니다.",
      matchStatus: ended.matchStatus,
    });
  }
}

export async function pollLinkedMatchesOnce(): Promise<void> {
  if (!process.env.API_SPORTS_KEY?.trim()) return;

  const kstToday = getKstDateString();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const matches = await MatchModel.find({
    apiSportsGameId: { $ne: null },
    matchStatus: { $nin: ["completed", "cancelled"] },
    $or: [{ matchDate: kstToday }, { matchDate: null, startTime: { $gte: today, $lt: tomorrow } }],
  }).lean();

  for (const match of matches) {
    try {
      await syncLinkedMatch(match);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown sync error";
      markApiSportsError(message);
      console.error(`[ApiSportsSync] match ${match.id} failed:`, message);
    }
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
