/** 공수교대·투수교체 광고 브레이크 타이밍 (초 단위 상수) */

/** 안내 연출(공수교대·투수교체) 후 광고 시작까지 — 클라 이벤트 표시와 동일 */
export const AD_INTRO_DELAY_MS = 5_000;

/** 광고 재생 고정 시간 (50초) — 종료 시 보상 가능. 예측 재개는 운영자 「예측 시작」 */
export const AD_PLAY_MS = 50_000;
export const AD_PLAY_SECONDS = Math.round(AD_PLAY_MS / 1000);

/** 공수교대·투수교체 전체 브레이크 (안내 5초 + 광고 50초) */
export const AD_BREAK_TOTAL_MS = AD_INTRO_DELAY_MS + AD_PLAY_MS;

/** 광고 재스케줄 최소 간격 (수동·자동 공통) */
export const AD_SCHEDULE_COOLDOWN_MS = AD_BREAK_TOTAL_MS;

/** 수동·자동 예측 열림 후 자동 중지 */
export const PREDICTION_AUTO_STOP_MS = 8_000;

export function adElapsedMs(
  adStartedAt: number | null | undefined,
  now = Date.now(),
): number {
  if (adStartedAt == null || !Number.isFinite(adStartedAt)) return 0;
  return Math.max(0, now - adStartedAt);
}

/** 서버 시작 시각 기준 AD_PLAY_MS가 지났으면 광고 세션은 끝난 것으로 본다. */
export function isAdPlayExpired(
  adStartedAt: number | null | undefined,
  now = Date.now(),
): boolean {
  if (adStartedAt == null || !Number.isFinite(adStartedAt)) return false;
  return now - adStartedAt >= AD_PLAY_MS;
}

export function adRemainingMs(
  adStartedAt: number | null | undefined,
  now = Date.now(),
): number {
  if (adStartedAt == null || !Number.isFinite(adStartedAt)) return AD_PLAY_MS;
  return Math.max(0, AD_PLAY_MS - (now - adStartedAt));
}

/** WS/HTTP 스냅샷 → 실제 표시할 광고 재생 여부 (만료분은 끈다) */
export function resolveAdPlayingFromServer(
  isAdPlaying: boolean | undefined,
  adStartedAt: number | null | undefined,
  now = Date.now(),
): { playing: boolean; startedAt: number | null; elapsedSec: number } {
  if (!isAdPlaying || adStartedAt == null || isAdPlayExpired(adStartedAt, now)) {
    return { playing: false, startedAt: null, elapsedSec: 0 };
  }
  return {
    playing: true,
    startedAt: adStartedAt,
    elapsedSec: Math.floor(adElapsedMs(adStartedAt, now) / 1000),
  };
}
