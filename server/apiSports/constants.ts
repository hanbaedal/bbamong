export const API_SPORTS_BASE_URL = "https://v1.baseball.api-sports.io";
/**
 * 경기관리 프리게임 시간당 sync (09:00 이후 ~ 첫 경기 시작 전).
 * 헬스 API 표시·문서용 — 실제 타이머는 matchManagementSchedule.
 */
export const MATCH_MGMT_PREGAME_HOURLY_MS = Math.max(
  60_000,
  parseInt(process.env.MATCH_MGMT_PREGAME_HOURLY_MS || String(60 * 60 * 1000), 10) || 60 * 60 * 1000,
);
/** @deprecated 헬스 폴백 — 프리게임 시간당 주기와 동일 */
export const MATCH_MGMT_SCHEDULED_SYNC_MS = MATCH_MGMT_PREGAME_HOURLY_MS;
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
/** live sync 대상 registrationOrder 상한 (기본 5 = op1~op5 전부) */
export const LIVE_SCORE_MAX_REGISTRATION_ORDER = Math.max(
  1,
  parseInt(process.env.LIVE_SCORE_MAX_REGISTRATION_ORDER || "5", 10) || 5,
);
/** API NS/TBD(시작 전)일 때 live sync API 재호출 최소 간격 — 2.5초 폭주 방지 */
export const LIVE_SCORE_NS_GATE_POLL_MS = Math.max(
  15_000,
  parseInt(process.env.LIVE_SCORE_NS_GATE_POLL_MS || "60000", 10) || 60_000,
);
/** 마지막 api-sports 성공 후 이 시간 이내면 healthy (3단계 스케줄 — 24h) */
export const HEALTH_STALE_MS = 24 * 60 * 60 * 1000;
export const KBO_LEAGUE_ID = Number(process.env.API_SPORTS_KBO_LEAGUE_ID || "5");

/** 라인업 재조회 간격 (live sync 중) */
export const LINEUP_REFRESH_MS = Math.max(
  60_000,
  parseInt(process.env.API_SPORTS_LINEUP_REFRESH_MS || String(15 * 60 * 1000), 10) ||
    15 * 60 * 1000,
);

export function resolveApiSportsSeason(fallbackDate?: string | Date): number {
  const fromEnv = Number(process.env.API_SPORTS_SEASON || "");
  if (Number.isFinite(fromEnv) && fromEnv > 2000) return fromEnv;
  if (fallbackDate) {
    const d = typeof fallbackDate === "string" ? fallbackDate : fallbackDate.toISOString();
    const year = Number(d.slice(0, 4));
    if (Number.isFinite(year) && year > 2000) return year;
  }
  return new Date().getFullYear();
}
