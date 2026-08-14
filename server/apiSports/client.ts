import { API_SPORTS_BASE_URL } from "./constants";
import {
  isEndpointCircuitOpen,
  isMissingEndpointError,
  openEndpointCircuit,
} from "./endpointCircuit";
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

type ApiSportsEnvelope<T> = {
  errors?: unknown;
  response?: T;
  paging?: { current?: number; total?: number };
};

async function apiSportsFetchEnvelope<T>(
  path: string,
  params: Record<string, string | number>,
): Promise<{ response: T; paging: { current: number; total: number } }> {
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

  const body = (await response.json()) as ApiSportsEnvelope<T>;
  if (body.errors && Object.keys(body.errors as object).length > 0) {
    const message = `API-SPORTS error: ${JSON.stringify(body.errors)}`;
    // 미제공 엔드포인트는 헬스 lastError를 오염시키지 않음
    if (!isMissingEndpointError(message)) {
      markApiSportsError(message);
    }
    throw new Error(message);
  }

  markApiSportsSuccess(latencyMs);
  const current = Number(body.paging?.current);
  const total = Number(body.paging?.total);
  return {
    response: body.response as T,
    paging: {
      current: Number.isFinite(current) && current > 0 ? current : 1,
      total: Number.isFinite(total) && total > 0 ? total : 1,
    },
  };
}

async function apiSportsFetch<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const { response } = await apiSportsFetchEnvelope<T>(path, params);
  return response;
}

/** 라인업·통계 등 선택 엔드포인트 — 실패 시 null (quota/404/미제공) */
async function apiSportsFetchOptional<T>(
  path: string,
  params: Record<string, string | number>,
): Promise<T | null> {
  if (isEndpointCircuitOpen(path)) {
    return null;
  }
  try {
    return await apiSportsFetch<T>(path, params);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isMissingEndpointError(message)) {
      openEndpointCircuit(path);
      return null;
    }
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

/** 팀 시즌 경기 목록 (/games?team=) — h2h 파라미터 미지원 시 폴백 */
export async function fetchGamesByTeamSeason(
  teamId: number,
  season: number,
  leagueId: number,
): Promise<ApiSportsGameResponse[] | null> {
  return apiSportsFetchOptional<ApiSportsGameResponse[]>("/games", {
    team: teamId,
    season,
    league: leagueId,
    timezone: "Asia/Seoul",
  });
}

/** 두 팀 시즌 상대전적 경기 목록 — h2h 우선, 실패 시 team 시즌 목록 교집합 */
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
  if (games && games.length > 0) return games;

  const reversed = await apiSportsFetchOptional<ApiSportsGameResponse[]>("/games", {
    h2h: `${homeTeamId}-${awayTeamId}`,
    season,
    league: leagueId,
    timezone: "Asia/Seoul",
  });
  if (reversed && reversed.length > 0) return reversed;

  // h2h 파라미터가 빈 배열이거나 실패한 경우 — 팀 시즌 경기로 폴백
  const [awayGames, homeGames] = await Promise.all([
    fetchGamesByTeamSeason(awayTeamId, season, leagueId),
    fetchGamesByTeamSeason(homeTeamId, season, leagueId),
  ]);
  if (!awayGames && !homeGames) {
    // h2h가 []로 성공한 경우도 여기로 올 수 있음 → 빈 배열 유지
    if (games) return games;
    if (reversed) return reversed;
    return null;
  }

  const pairIds = new Set([awayTeamId, homeTeamId]);
  const byId = new Map<number, ApiSportsGameResponse>();
  for (const game of [...(awayGames ?? []), ...(homeGames ?? [])]) {
    const ids = [game.teams?.away?.id, game.teams?.home?.id];
    if (ids.every((id) => typeof id === "number" && pairIds.has(id))) {
      byId.set(game.id, game);
    }
  }
  return Array.from(byId.values());
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

/** 빈 배열은 엔드포인트 존재·데이터 없음 — 별칭 경로를 이어서 두드리지 않음 */
function firstLineupPayload(rows: unknown): "data" | "empty" | "miss" {
  if (rows == null) return "miss";
  if (Array.isArray(rows)) return rows.length > 0 ? "data" : "empty";
  if (typeof rows === "object") return "data";
  return "empty";
}

/** 경기 라인업 — API-Sports baseball (경로·응답 형태 방어적 시도) */
export async function fetchGameLineups(gameId: number): Promise<unknown | null> {
  const attempts: Array<[string, Record<string, string | number>]> = [
    ["/lineups", { game: gameId }],
    ["/lineups", { id: gameId }],
    ["/games/lineups", { id: gameId }],
  ];

  for (const [path, params] of attempts) {
    const rows = await apiSportsFetchOptional<unknown>(path, params);
    const kind = firstLineupPayload(rows);
    if (kind === "data") return rows;
    if (kind === "empty") return null;
  }

  return null;
}

/** 경기별 선수 통계 (box score) */
export async function fetchGameStatistics(gameId: number): Promise<unknown | null> {
  const stats = await apiSportsFetchOptional<unknown>("/games/statistics", { id: gameId });
  const statsKind = firstLineupPayload(stats);
  if (statsKind === "data") return stats;
  if (statsKind === "empty") return null;

  const fallback = await apiSportsFetchOptional<unknown>("/statistics", { game: gameId });
  if (firstLineupPayload(fallback) === "data") return fallback;
  return null;
}

/** 리그 구단 목록 */
export async function fetchLeagueTeams(
  leagueId: number,
  season: number,
): Promise<Array<{ id: number; name: string }>> {
  const rows = await apiSportsFetchOptional<unknown[]>("/teams", { league: leagueId, season });
  if (!rows?.length) return [];

  const teams: Array<{ id: number; name: string }> = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const nested = row.team && typeof row.team === "object" ? (row.team as Record<string, unknown>) : row;
    const idRaw = nested.id;
    const nameRaw = nested.name;
    const id = typeof idRaw === "number" ? idRaw : Number.parseInt(String(idRaw ?? ""), 10);
    const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
    if (!Number.isFinite(id) || id <= 0 || !name) continue;
    teams.push({ id, name });
  }
  return teams;
}

/** 팀 로스터 + 시즌 통계 (1페이지 — 라인업 조회용) */
export async function fetchTeamPlayers(teamId: number, season: number): Promise<unknown[] | null> {
  return apiSportsFetchOptional<unknown[]>("/players", { team: teamId, season });
}

/** 팀 로스터 전체 페이지 (관리자 선수단 가져오기 — 구단당 수 회) */
export async function fetchTeamPlayersAllPages(
  teamId: number,
  season: number,
): Promise<unknown[] | null> {
  if (isEndpointCircuitOpen("/players")) return null;

  const all: unknown[] = [];
  const maxPages = 8;
  try {
    for (let page = 1; page <= maxPages; page++) {
      const { response, paging } = await apiSportsFetchEnvelope<unknown[]>("/players", {
        team: teamId,
        season,
        page,
      });
      const rows = Array.isArray(response) ? response : [];
      all.push(...rows);
      if (page >= paging.total || rows.length === 0) break;
    }
    return all;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isMissingEndpointError(message)) {
      openEndpointCircuit("/players");
      return all.length ? all : null;
    }
    console.warn(`[ApiSports] optional /players skipped: ${message}`);
    return all.length ? all : null;
  }
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
