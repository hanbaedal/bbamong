/** 공수교대·투수교체 광고 브레이크 타이밍 (초 단위 상수) */

/** 안내 연출 후 광고 시작까지 */
export const AD_INTRO_DELAY_MS = 10_000;

/** 광고 재생 고정 시간 (2분) — 종료 시 보상 가능 */
export const AD_PLAY_MS = 120_000;

/** 공수교대·투수교체 전체 브레이크 (2분 10초) */
export const AD_BREAK_TOTAL_MS = 130_000;

/** 광고 재스케줄 최소 간격 (수동·자동 공통) */
export const AD_SCHEDULE_COOLDOWN_MS = AD_BREAK_TOTAL_MS;

/** 수동·자동 예측 열림 후 자동 중지 */
export const PREDICTION_AUTO_STOP_MS = 8_000;
