/**
 * 경기관리 프리게임 시간당 sync (09:00 이후 ~ 첫 경기 시작 전).
 * 실제 타이머는 matchManagementSchedule.
 */
export const MATCH_MGMT_PREGAME_HOURLY_MS = Math.max(
  60_000,
  parseInt(process.env.MATCH_MGMT_PREGAME_HOURLY_MS || String(60 * 60 * 1000), 10) || 60 * 60 * 1000,
);
/** 1경기 실시간 스코어 주기 (기본 2초 — TV 체감 지연 완화, 최소 1.5초) */
export const LIVE_SCORE_SYNC_INTERVAL_MS = Math.max(
  1_500,
  parseInt(process.env.LIVE_SCORE_SYNC_INTERVAL_MS || "2000", 10) || 2_000,
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
/** 시작 전(NS)일 때 live sync 재호출 최소 간격 — 2.5초 폭주 방지 */
export const LIVE_SCORE_NS_GATE_POLL_MS = Math.max(
  15_000,
  parseInt(process.env.LIVE_SCORE_NS_GATE_POLL_MS || "60000", 10) || 60_000,
);

export function resolveApiSportsSeason(fallbackDate?: string | Date): number {
  const fromEnv = Number(process.env.KBO_SEASON || process.env.API_SPORTS_SEASON || "");
  if (Number.isFinite(fromEnv) && fromEnv > 2000) return fromEnv;
  if (fallbackDate) {
    const d = typeof fallbackDate === "string" ? fallbackDate : fallbackDate.toISOString();
    const year = Number(d.slice(0, 4));
    if (Number.isFinite(year) && year > 2000) return year;
  }
  return new Date().getFullYear();
}
