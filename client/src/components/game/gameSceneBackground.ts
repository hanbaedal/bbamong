import type { GameDayPhase } from "@/lib/gameDayPhase";
import type { InningHalf } from "@shared/gamePhaseTypes";
import type { GameScreenPhase } from "./gameTypes";

/**
 * 예측 화면 배경 장면.
 * - field: 기존 game-stadium-bg.png + 필드 좌표 (예측 선택·주루·이벤트)
 * - before / wait_* / pitch_*: object-cover 시네마틱 (좌표 없음)
 */
export type GameSceneKind =
  | "field"
  | "before"
  | "wait_away"
  | "wait_home"
  | "pitch_away"
  | "pitch_home";

export function isCinematicGameScene(kind: GameSceneKind): boolean {
  return kind !== "field";
}

/**
 * 시네마틱은 좌표가 없는 사진이다.
 * picking·주루·실패·투수교체·공수교대는 반드시 field 를 쓴다.
 */
export function resolveGameSceneKind(input: {
  gameDayPhase: GameDayPhase;
  screenPhase: GameScreenPhase;
  inningHalf?: InningHalf | null;
}): GameSceneKind {
  const { gameDayPhase, screenPhase, inningHalf } = input;
  const away = inningHalf === "top";

  if (
    gameDayPhase === "pregame" ||
    gameDayPhase === "no_match" ||
    gameDayPhase === "all_ended" ||
    gameDayPhase === "loading"
  ) {
    return "before";
  }

  if (gameDayPhase === "live") {
    if (screenPhase === "wait_start") return away ? "wait_away" : "wait_home";
    if (screenPhase === "wait_result" || screenPhase === "result_flash") {
      return away ? "pitch_away" : "pitch_home";
    }
  }

  return "field";
}

/** 시네마틱 위 말풍선·예측 배지 위치 (뷰포트 %) */
export function cinematicHudAnchor(kind: GameSceneKind): {
  left: string;
  bottom: string;
  transform: string;
} {
  switch (kind) {
    case "wait_away":
      return { left: "38%", bottom: "22%", transform: "translate(-50%, 0)" };
    case "wait_home":
      return { left: "46%", bottom: "20%", transform: "translate(-50%, 0)" };
    case "pitch_home":
      return { left: "36%", bottom: "24%", transform: "translate(-50%, 0)" };
    case "pitch_away":
      return { left: "26%", bottom: "26%", transform: "translate(-50%, 0)" };
    default:
      return { left: "50%", bottom: "22%", transform: "translate(-50%, 0)" };
  }
}
