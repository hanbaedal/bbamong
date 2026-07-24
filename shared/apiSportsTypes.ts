export type MatchControlMode = "auto" | "manual";

export interface LiveScoreboard {
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  homeHits: number;
  awayHits: number;
  homeErrors: number;
  awayErrors: number;
  inning: number | null;
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
