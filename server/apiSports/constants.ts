export const API_SPORTS_BASE_URL = "https://v1.baseball.api-sports.io";
export const DEFAULT_POLL_INTERVAL_MS = 2500;
/** 경기 시작(KST) 몇 ms 전부터 api-baseball live 폴링 시작 */
export const POLL_START_BEFORE_MS = 60_000;
/**
 * 동시 live api-baseball 폴링 경기 수 (기본 1).
 * 2로 올리면 사이클당 API 2회 — 일 7500건 한도에서 2경기 full 폴링은 2.5초 주기로는 부족할 수 있음.
 */
export const MAX_LIVE_POLL_GAMES = Math.min(
  2,
  Math.max(1, Number(process.env.API_SPORTS_MAX_LIVE_POLL_GAMES || "1") || 1),
);
export const HEALTH_STALE_MS = 10000;
export const KBO_LEAGUE_ID = Number(process.env.API_SPORTS_KBO_LEAGUE_ID || "5");
