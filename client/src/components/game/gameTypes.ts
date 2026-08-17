export type PredictionOption = "1루" | "2루" | "3루" | "홈런" | "아웃";

/** round_next WS — 라운드 진행 사유 */
export type RoundAdvanceType = "next_batter" | "pitcher_change" | "switch_half";

export type GameScreenPhase =
  | "wait_start"
  | "picking"
  | "wait_result"
  | "success_announce"
  | "success_running"
  | "success_celebrate"
  | "fail"
  | "pitcher_change_event"
  | "inning_switch_event"
  | "ad_playing"
  | "match_ended";

export type PredictionResult = "pending" | "success" | "fail";

/** 투수 교체·공수 교대 연출 표시 시간 */
export const GAME_EVENT_SHOW_MS = 5000;

/** 경기종료 연출 */
export const MATCH_ENDED_SHOW_MS = 10_000;

/** 주루 후 「예측 성공」 배너 (레거시 타이머 — 배트 연출이 먼저) */
export const SUCCESS_ANNOUNCE_MS = 2000;

/** 주루 도착 후 제자리 점프 3회 */
export const SUCCESS_HOP_MS = 1350;

/** 자리비움 따라잡기 — 다음 타석 예측 창을 남기기 위한 짧은 결과 배너 */
export const CATCHUP_RESULT_MS = 700;

export function isPageHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

export function isSuccessPresentationPhase(phase: GameScreenPhase): boolean {
  return (
    phase === "success_announce" ||
    phase === "success_running" ||
    phase === "success_celebrate"
  );
}

/** 투수/공수 안내·광고 — 복귀 /check 가 이 연출을 대기/피킹으로 덮지 않음 */
export function isTransientAdOrEventPhase(phase: GameScreenPhase): boolean {
  return (
    phase === "pitcher_change_event" ||
    phase === "inning_switch_event" ||
    phase === "ad_playing"
  );
}
