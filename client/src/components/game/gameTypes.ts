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
  | "ad_playing";

export type PredictionResult = "pending" | "success" | "fail";

/** 투수 교체·공수 교대 연출 표시 시간 */
export const GAME_EVENT_SHOW_MS = 5000;

/** 예측 성공 직후 「예측 성공」 축하를 먼저 보여주는 시간 */
export const SUCCESS_ANNOUNCE_MS = 2000;

/** 주루 도착 후 제자리 점프 3회 */
export const SUCCESS_HOP_MS = 1350;

export function isSuccessPresentationPhase(phase: GameScreenPhase): boolean {
  return (
    phase === "success_announce" ||
    phase === "success_running" ||
    phase === "success_celebrate"
  );
}
