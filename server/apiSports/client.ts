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
