export type PredictionOption = "1루" | "2루" | "3루" | "홈런" | "아웃";

/** round_next WS — 라운드 진행 사유 */
export type RoundAdvanceType = "next_batter" | "pitcher_change" | "switch_half";

export type GameScreenPhase =
  | "wait_start"
  | "picking"
  | "wait_result"
  | "success_running"
  | "success_celebrate"
  | "fail"
  | "pitcher_change_event"
  | "inning_switch_event"
  | "ad_playing";

export type PredictionResult = "pending" | "success" | "fail";

/** 투수 교체·공수 교대 연출 표시 시간 */
export const GAME_EVENT_SHOW_MS = 5000;
