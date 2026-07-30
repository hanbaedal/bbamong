import type { InningHalf } from "./gamePhaseTypes";

export type MatchControlMode = "auto" | "manual";

/** api-sports innings 키( "1"~"9", "extra" 등 ) → 해당 이닝 득점 */
export type InningRunsMap = Record<string, number | null>;

export interface LiveScoreboard {
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  homeHits: number;
  awayHits: number;
  homeErrors: number;
  awayErrors: number;
  /** 이닝별 득점 (api-sports scores.*.innings) */
  homeInnings?: InningRunsMap;
  awayInnings?: InningRunsMap;
  inning: number | null;
  /** API status에서 파싱 — top=초(원정 공격), bottom=말(홈 공격) */
  inningHalf?: InningHalf | null;
  inningLabel: string;
  statusShort: string;
  statusLong: string;
  syncedAt: string;
}

export interface ApiSportsHealthStatus {
  healthy: boolean;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  pollIntervalMs: number;
  latencyMs: number | null;
  apiKeyConfigured: boolean;
}

export interface ApiSportsTodayGame {
  apiSportsGameId: number;
  date: string;
  time: string;
  homeTeamName: string;
  awayTeamName: string;
  statusShort: string;
  statusLong: string;
  homeScore: number;
  awayScore: number;
  venueName?: string;
}

export interface BettingDistributionItem {
  prediction: string;
  count: number;
  totalPoints: number;
  odds: number;
}
