export const API_SPORTS_BASE_URL = "https://v1.baseball.api-sports.io";
export const DEFAULT_POLL_INTERVAL_MS = 2500;
/** 경기 시작(KST) 몇 ms 전부터 api-baseball 폴링 시작 */
export const POLL_START_BEFORE_MS = 60_000;
export const HEALTH_STALE_MS = 10000;
export const KBO_LEAGUE_ID = Number(process.env.API_SPORTS_KBO_LEAGUE_ID || "5");
