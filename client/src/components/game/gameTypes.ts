export type PredictionOption = "1루" | "2루" | "3루" | "홈런" | "아웃";

export type GameScreenPhase =
  | "wait_start"
  | "picking"
  | "wait_result"
  | "success_running"
  | "success_celebrate"
  | "fail";

export type PredictionResult = "pending" | "success" | "fail";
