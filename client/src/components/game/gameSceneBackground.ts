import type { GameDayPhase } from "@/lib/gameDayPhase";
import type { InningHalf } from "@shared/gamePhaseTypes";
import type { BatterHandSide } from "@shared/batterHandedness";
import type { GameScreenPhase } from "./gameTypes";

/**
 * 예측 화면 배경 장면.
 * - field: game-stadium-field.jpg + 필드 좌표 (예측 선택·실패·투수교체·공수교대)
 * - running: scene-running.jpg + 주루 전용 베이스 좌표
 * - before / wait_* / pitch_*: object-cover 시네마틱 (좌표 없음)
 */
export type GameSceneKind =
  | "field"
  | "running"
  | "before"
  | "wait_away"
  | "wait_home"
  | "pitch_away"
  | "pitch_home";

/** 시네마틱은 필드 스프라이트를 숨긴다. 투구 장면 스트라이크존은 전경 플레이트 좌표를 쓴다. */
export function isCinematicGameScene(kind: GameSceneKind): boolean {
  return kind !== "field" && kind !== "running";
}

export function isRunningGameScene(kind: GameSceneKind): boolean {
  return kind === "running";
}

/**
 * 시네마틱은 좌표가 없는 사진이다.
 * picking·실패·투수교체·공수교대는 field, 주루 연출만 running.
 */
export function resolveGameSceneKind(input: {
  gameDayPhase: GameDayPhase;
  screenPhase: GameScreenPhase;
  inningHalf?: InningHalf | null;
  batsSide?: BatterHandSide | null;
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
    if (screenPhase === "wait_start") {
      // 원정=파란 유니폼 사진, 홈=흰 유니폼 사진. 화면 전체를 줄이지 않는다.
      return away ? "wait_away" : "wait_home";
    }
    if (screenPhase === "wait_result" || screenPhase === "result_flash") {
      return away ? "pitch_away" : "pitch_home";
    }
    if (
      screenPhase === "success_running" ||
      screenPhase === "success_announce" ||
      screenPhase === "success_celebrate"
    ) {
      return "running";
    }
  }

  return "field";
}

/**
 * 투구 사진에는 우타가 포수 왼쪽에 구워져 있다. 좌타 결과대기만 배경을 뒤집는다.
 * 원정/홈 대기 사진은 유니폼이 다르므로 뒤집지 않는다.
 */
export function shouldMirrorCinematic(
  kind: GameSceneKind,
  batsSide?: BatterHandSide | null,
): boolean {
  return batsSide === "left" && (kind === "pitch_home" || kind === "pitch_away");
}

/** 시네마틱 위 말풍선 위치 (뷰포트 %). 사진 속 빠몽 쪽에 둔다. */
export function cinematicHudAnchor(kind: GameSceneKind): {
  left: string;
  bottom: string;
  transform: string;
} {
  switch (kind) {
    case "wait_away":
      // 원정 대기 사진은 빠몽이 프레임 오른쪽
      return { left: "66%", bottom: "22%", transform: "translate(-50%, 0)" };
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
