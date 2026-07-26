export const API_SPORTS_BASE_URL = "https://v1.baseball.api-sports.io";
/** 3단계 스케줄만 사용 시 — 헬스 API 표시용 */
export const MATCH_MGMT_SCHEDULED_SYNC_MS = 0;
/** 1경기 실시간 스코어 api-sports 주기 (기본 2.5초 — 사용자 DB 폴링 3초와 맞춤) */
export const LIVE_SCORE_SYNC_INTERVAL_MS = Math.max(
  2_500,
  parseInt(process.env.LIVE_SCORE_SYNC_INTERVAL_MS || "2500", 10) || 2_500,
);
/** 경기 시작 몇 ms 전부터 live sync (클라이언트 폴링과 동일 1분) */
export const LIVE_SCORE_SYNC_START_BEFORE_MS = Math.max(
  0,
  parseInt(process.env.LIVE_SCORE_SYNC_START_BEFORE_MS || "60000", 10) || 60_000,
);
/** live sync 대상 registrationOrder 상한 (기본 1 = 1경기만) */
export const LIVE_SCORE_MAX_REGISTRATION_ORDER = Math.max(
  1,
  parseInt(process.env.LIVE_SCORE_MAX_REGISTRATION_ORDER || "1", 10) || 1,
);
/** 마지막 api-sports 성공 후 이 시간 이내면 healthy (3단계 스케줄 — 24h) */
export const HEALTH_STALE_MS = 24 * 60 * 60 * 1000;
export const KBO_LEAGUE_ID = Number(process.env.API_SPORTS_KBO_LEAGUE_ID || "5");
