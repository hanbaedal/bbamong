import type { InningHalf } from "./gamePhaseTypes";

export type MatchControlMode = "auto" | "manual";

/** api-sports innings 키( "1"~"9", "extra" 등 ) → 해당 이닝 득점 */
export type InningRunsMap = Record<string, number | null>;

export interface LiveScoreboard {
  homeTeamName: string;
  awayTeamName: string;
  /** 다음 스포츠 teams.imageUrl (관리자 일정 등) */
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  homeScore: number;
  awayScore: number;
  homeHits: number;
  awayHits: number;
  homeErrors: number;
  awayErrors: number;
  /** 볼넷 (다음 스포츠 ballfour) — 네이버에서 가져오지 않음 */
  homeWalks?: number;
  awayWalks?: number;
  /** 이닝별 득점 (다음 스포츠 inning CSV) */
  homeInnings?: InningRunsMap;
  awayInnings?: InningRunsMap;
  /** 다음 스포츠 periodType (T1/B3 …). 예측 공수교대(gameInning)와 별개 */
  inning: number | null;
  /** 다음 스포츠 — top=초(원정 공격), bottom=말(홈 공격) */
  inningHalf?: InningHalf | null;
  inningLabel: string;
  statusShort: string;
  statusLong: string;
  /** 네이버 문자중계 전용. 점수·이닝과 섞지 않음 */
  situation?: LiveScoreSituation | null;
  syncedAt: string;
}

/** 실시간 볼카운트·아웃·주자·타석 */
export interface LiveScoreSituation {
  balls: number;
  strikes: number;
  outs: number;
  first: boolean;
  second: boolean;
  third: boolean;
  batterName?: string | null;
  /** 예: "1구 볼" */
  pitchLabel?: string | null;
  /** 예: "143km/h 체인지업" */
  pitchDetail?: string | null;
}

/** 팀 시즌 성적 (다음 스포츠 순위표) */
export interface TeamSeasonStats {
  teamShort: string;
  season: number;
  rank: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  winningPercentage: string | null;
  battingAverage: string | null;
  era: string | null;
  gamesBehind: string | null;
}

export interface MatchTeamSeasonStats {
  season: number;
  home: TeamSeasonStats | null;
  away: TeamSeasonStats | null;
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
  daumGameId?: number;
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

/** API-Sports 라인업 1명 (타순) */
export interface LineupBatterEntry {
  playerId: number;
  name: string;
  battingOrder: number;
  /** 관리자 선수단 id — 수동 타순에서 스냅샷 출처 */
  rosterPlayerId?: string;
}

/** Match DB에 저장하는 라인업 스냅샷 */
export interface MatchLineupSnapshot {
  syncedAt: string;
  home: LineupBatterEntry[];
  away: LineupBatterEntry[];
  /**
   * api: 외부 실황 라인업
   * today-lineup: 오늘의 선발명단(다음/네이버) 자동·관리자 적용
   * manual: 운영자가 직접 고른 타순 — 자동 적용이 덮지 않음
   */
  source?: "api" | "manual" | "today-lineup";
}

/** 선수 시즌 타격 요약 (playerId 문자열 키) */
export interface MatchPlayerStatsEntry {
  battingAverage: string | null;
  hits: number | null;
  homeRuns: number | null;
  rbi: number | null;
  ops: string | null;
  runs?: number | null;
  stolenBases?: number | null;
  onBasePercentage?: string | null;
  position?: string | null;
  note?: string | null;
  syncedAt: string;
}

/** 시즌 상대전적 스냅샷 (DB 저장) */
export interface MatchHeadToHeadSnapshot {
  awayWins: number;
  homeWins: number;
  season: number;
  syncedAt: string;
}

/** 사용자 화면 — 현재 타자 + 시즌 타격 기록 */
export interface CurrentBatterPreview {
  orderLabel: string;
  playerName: string | null;
  battingAverage: string | null;
  hits: number | null;
  homeRuns: number | null;
  rbi: number | null;
  ops: string | null;
  runs?: number | null;
  stolenBases?: number | null;
  onBasePercentage?: string | null;
  position?: string | null;
  note?: string | null;
  season: number;
  /** 운영자가 설정한 대타 타석 */
  isPinchHitter?: boolean;
}

/** 운영자 대타 입력 — 현재 타석만 적용 */
export interface PinchHitterSnapshot {
  playerName: string;
  battingAverage: string | null;
  hits: number | null;
  homeRuns: number | null;
  rbi: number | null;
  ops: string | null;
  runs?: number | null;
  stolenBases?: number | null;
  onBasePercentage?: string | null;
  position?: string | null;
  note?: string | null;
  rosterPlayerId?: string;
  season: number;
  batterIndexInHalf: number;
  inningHalf: "top" | "bottom";
  gameInning: number;
  setAt: string;
}
