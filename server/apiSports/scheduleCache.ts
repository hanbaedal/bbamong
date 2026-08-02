import { ApiSportsScheduleCacheModel } from "../UserStorage/db";
import { getKstDateString } from "../utils/dateUtils";
import { fetchGamesByDate, type ApiSportsGameResponse } from "./client";
import { KBO_LEAGUE_ID } from "./constants";
import { isGameFinished, isGameLiveStatus, isGamePostponedOrCancelled } from "./scoreboardParser";

function venueNameFromGame(game: ApiSportsGameResponse): string {
  return game.venue?.name?.trim() || "API자동";
}

function docToGameResponse(doc: Record<string, unknown>): ApiSportsGameResponse {
  return {
    id: doc.apiSportsGameId as number,
    date: doc.date as string,
    time: (doc.time as string) ?? "",
    timestamp: (doc.timestamp as number) ?? 0,
    status: {
      short: (doc.statusShort as string) ?? "NS",
      long: (doc.statusLong as string) ?? "",
    },
    teams: {
      home: {
        id: (doc.homeTeamId as number) ?? 0,
        name: doc.homeTeamName as string,
      },
      away: {
        id: (doc.awayTeamId as number) ?? 0,
        name: doc.awayTeamName as string,
      },
    },
    scores: {
      home: { total: (doc.homeScore as number) ?? 0 },
      away: { total: (doc.awayScore as number) ?? 0 },
    },
    venue: {
      name: (doc.venueName as string) ?? "",
      city: (doc.venueCity as string) ?? "",
    },
  };
}

function isPastMatchDate(matchDate: string): boolean {
  return matchDate < getKstDateString();
}

/** 과거 날짜 캐시가 NS 등 미종료 상태면 API 재조회 필요 */
function isScheduleCacheStale(
  matchDate: string,
  cached: Array<{ statusShort?: string | null; homeScore?: number | null; awayScore?: number | null }>,
): boolean {
  if (cached.length === 0) return false;

  if (isPastMatchDate(matchDate)) {
    return cached.some((doc) => {
      const short = (doc.statusShort ?? "NS").toUpperCase();
      if (isGamePostponedOrCancelled(short)) return false;
      return !isGameFinished(short);
    });
  }

  if (matchDate !== getKstDateString()) return false;

  let hasSuspiciousZero = false;
  let hasLive = false;
  for (const doc of cached) {
    const short = (doc.statusShort ?? "NS").toUpperCase();
    const total = (doc.homeScore ?? 0) + (doc.awayScore ?? 0);
    if (total === 0 && (isGamePostponedOrCancelled(short) || isGameFinished(short))) {
      hasSuspiciousZero = true;
    }
    if (total > 0 || isGameLiveStatus(short)) {
      hasLive = true;
    }
  }
  return hasSuspiciousZero && hasLive;
}

export async function upsertScheduleCacheFromApiGames(
  matchDate: string,
  games: ApiSportsGameResponse[],
): Promise<void> {
  for (const game of games) {
    const scoreboardHome = game.scores?.home?.total ?? 0;
    const scoreboardAway = game.scores?.away?.total ?? 0;
    await ApiSportsScheduleCacheModel.updateOne(
      { matchDate, apiSportsGameId: game.id },
      {
        matchDate,
        apiSportsGameId: game.id,
        season: game.league?.season ?? Number(matchDate.slice(0, 4)),
        leagueId: game.league?.id ?? KBO_LEAGUE_ID,
        date: game.date,
        time: game.time ?? "",
        timestamp: game.timestamp ?? 0,
        statusShort: game.status.short,
        statusLong: game.status.long,
        homeTeamId: game.teams.home.id,
        homeTeamName: game.teams.home.name,
        awayTeamId: game.teams.away.id,
        awayTeamName: game.teams.away.name,
        venueName: venueNameFromGame(game),
        venueCity: game.venue?.city ?? "",
        homeScore: scoreboardHome,
        awayScore: scoreboardAway,
        fetchedAt: new Date(),
      },
      { upsert: true },
    );
  }
}

/** DB 캐시 우선. forceApi=true 이면 api-baseball에서 다시 읽어 캐시·경기 등록에 반영 */
export async function getScheduleGamesForDate(
  matchDate: string,
  options?: { forceApi?: boolean },
): Promise<{ games: ApiSportsGameResponse[]; source: "cache" | "api" }> {
  if (options?.forceApi) {
    const apiGames = await fetchGamesByDate(matchDate, KBO_LEAGUE_ID);
    if (apiGames.length > 0) {
      await upsertScheduleCacheFromApiGames(matchDate, apiGames);
    }
    return { games: apiGames, source: "api" };
  }

  const cached = await ApiSportsScheduleCacheModel.find({ matchDate })
    .sort({ timestamp: 1, apiSportsGameId: 1 })
    .lean();

  if (cached.length > 0) {
    if (isScheduleCacheStale(matchDate, cached)) {
      const apiGames = await fetchGamesByDate(matchDate, KBO_LEAGUE_ID);
      if (apiGames.length > 0) {
        await upsertScheduleCacheFromApiGames(matchDate, apiGames);
      }
      return { games: apiGames, source: "api" };
    }
    return {
      games: cached.map((doc) => docToGameResponse(doc as Record<string, unknown>)),
      source: "cache",
    };
  }

  const apiGames = await fetchGamesByDate(matchDate, KBO_LEAGUE_ID);
  if (apiGames.length > 0) {
    await upsertScheduleCacheFromApiGames(matchDate, apiGames);
  }
  return { games: apiGames, source: "api" };
}

function dateKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 시즌 일정 일괄 적재 — 캐시 없는 날짜만 API 호출 */
export async function importSeasonScheduleToCache(season: number): Promise<{
  season: number;
  daysChecked: number;
  daysFetchedFromApi: number;
  gamesCached: number;
}> {
  const start = new Date(season, 2, 1);
  const end = new Date(season, 9, 31);
  let daysChecked = 0;
  let daysFetchedFromApi = 0;
  let gamesCached = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const matchDate = dateKeyFromDate(d);
    daysChecked += 1;

    const existing = await ApiSportsScheduleCacheModel.countDocuments({ matchDate });
    if (existing > 0) continue;

    const apiGames = await fetchGamesByDate(matchDate, KBO_LEAGUE_ID);
    if (apiGames.length > 0) {
      await upsertScheduleCacheFromApiGames(matchDate, apiGames);
      daysFetchedFromApi += 1;
      gamesCached += apiGames.length;
    }

    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  return { season, daysChecked, daysFetchedFromApi, gamesCached };
}
