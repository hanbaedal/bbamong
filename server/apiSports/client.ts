import { API_SPORTS_BASE_URL } from "./constants";
import { markApiSportsError, markApiSportsSuccess } from "./healthState";

export interface ApiSportsGameResponse {
  id: number;
  date: string;
  time: string;
  timestamp: number;
  status: { long: string; short: string };
  teams: {
    home: { id: number; name: string; logo?: string };
    away: { id: number; name: string; logo?: string };
  };
  scores?: {
    home?: {
      hits?: number;
      errors?: number;
      total?: number;
      innings?: Record<string, number | null>;
    };
    away?: {
      hits?: number;
      errors?: number;
      total?: number;
      innings?: Record<string, number | null>;
    };
  };
  league?: { id: number; name: string; season?: number };
  /** API-SPORTS venue (있을 때) */
  venue?: {
    id?: number;
    name?: string;
    city?: string;
    country?: string;
  };
}

function getApiKey(): string {
  const key = process.env.API_SPORTS_KEY?.trim();
  if (!key) {
    throw new Error("API_SPORTS_KEY가 설정되지 않았습니다.");
  }
  return key;
}

async function apiSportsFetch<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const started = Date.now();
  const url = new URL(`${API_SPORTS_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    headers: {
      "x-apisports-key": getApiKey(),
    },
  });

  const latencyMs = Date.now() - started;

  if (!response.ok) {
    const message = `API-SPORTS HTTP ${response.status}`;
    markApiSportsError(message);
    throw new Error(message);
  }

  const body = (await response.json()) as { errors?: unknown; response?: T };
  if (body.errors && Object.keys(body.errors as object).length > 0) {
    const message = `API-SPORTS error: ${JSON.stringify(body.errors)}`;
    markApiSportsError(message);
    throw new Error(message);
  }

  markApiSportsSuccess(latencyMs);
  return body.response as T;
}

/** 라인업·통계 등 선택 엔드포인트 — 실패 시 null (quota/404) */
async function apiSportsFetchOptional<T>(
  path: string,
  params: Record<string, string | number>,
): Promise<T | null> {
  try {
    return await apiSportsFetch<T>(path, params);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[ApiSports] optional ${path} skipped: ${message}`);
    return null;
  }
}

export async function fetchGamesByDate(date: string, leagueId: number): Promise<ApiSportsGameResponse[]> {
  // league와 함께 요청 시 season이 필수 (API-SPORTS)
  const seasonFromEnv = Number(process.env.API_SPORTS_SEASON || "");
  const season = Number.isFinite(seasonFromEnv) && seasonFromEnv > 2000
    ? seasonFromEnv
    : Number(date.slice(0, 4));

  return apiSportsFetch<ApiSportsGameResponse[]>("/games", {
    date,
    league: leagueId,
    season,
    timezone: "Asia/Seoul",
  });
}

export async function fetchGameById(gameId: number): Promise<ApiSportsGameResponse | null> {
  const games = await apiSportsFetch<ApiSportsGameResponse[]>("/games", { id: gameId });
  return games[0] ?? null;
}

/** 두 팀 시즌 상대전적 경기 목록 */
export async function fetchHeadToHeadGames(
  awayTeamId: number,
  homeTeamId: number,
  season: number,
  leagueId: number,
): Promise<ApiSportsGameResponse[] | null> {
  const h2h = `${awayTeamId}-${homeTeamId}`;
  const games = await apiSportsFetchOptional<ApiSportsGameResponse[]>("/games", {
    h2h,
    season,
    league: leagueId,
    timezone: "Asia/Seoul",
  });
  if (games?.length) return games;

  const reversed = await apiSportsFetchOptional<ApiSportsGameResponse[]>("/games", {
    h2h: `${homeTeamId}-${awayTeamId}`,
    season,
    league: leagueId,
    timezone: "Asia/Seoul",
  });
  return reversed;
}

export function apiSportsTeamIdsFromGame(game: ApiSportsGameResponse): {
  apiSportsHomeTeamId: number;
  apiSportsAwayTeamId: number;
} {
  return {
    apiSportsHomeTeamId: game.teams.home.id,
    apiSportsAwayTeamId: game.teams.away.id,
  };
}

/** 경기 라인업 — API-Sports baseball (경로·응답 형태 방어적 시도) */
export async function fetchGameLineups(gameId: number): Promise<unknown[] | null> {
  const byGameParam = await apiSportsFetchOptional<unknown[]>("/lineups", { game: gameId });
  if (byGameParam?.length) return byGameParam;

  const byIdParam = await apiSportsFetchOptional<unknown[]>("/lineups", { id: gameId });
  if (byIdParam?.length) return byIdParam;

  const byGamesLineups = await apiSportsFetchOptional<unknown[]>("/games/lineups", { id: gameId });
  if (byGamesLineups?.length) return byGamesLineups;

  return null;
}

/** 경기별 선수 통계 (box score) */
export async function fetchGameStatistics(gameId: number): Promise<unknown[] | null> {
  const stats = await apiSportsFetchOptional<unknown[]>("/games/statistics", { id: gameId });
  if (stats?.length) return stats;

  return apiSportsFetchOptional<unknown[]>("/statistics", { game: gameId });
}

/** 팀 로스터 + 시즌 통계 */
export async function fetchTeamPlayers(teamId: number, season: number): Promise<unknown[] | null> {
  return apiSportsFetchOptional<unknown[]>("/players", { team: teamId, season });
}

/** 선수 시즌 통계 */
export async function fetchPlayerStatistics(
  playerId: number,
  season: number,
  leagueId: number,
): Promise<unknown[] | null> {
  return apiSportsFetchOptional<unknown[]>("/players/statistics", {
    player: playerId,
    season,
    league: leagueId,
  });
}
