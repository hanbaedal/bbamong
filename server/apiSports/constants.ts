export const API_SPORTS_BASE_URL = "https://v1.baseball.api-sports.io";
/** 연속 폴링 없음(3단계 스케줄) — 헬스 API 표시용 */
export const MATCH_MGMT_SCHEDULED_SYNC_MS = 0;
/** 마지막 api-sports 성공 후 이 시간 이내면 healthy (3단계 스케줄 — 24h) */
export const HEALTH_STALE_MS = 24 * 60 * 60 * 1000;
export const KBO_LEAGUE_ID = Number(process.env.API_SPORTS_KBO_LEAGUE_ID || "5");
