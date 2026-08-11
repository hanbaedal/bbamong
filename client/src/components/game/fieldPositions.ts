import type { PredictionOption } from "./gameTypes";
import { getRunPathImagePoints } from "./stadiumFieldCoords";

export interface FieldPoint {
  left: string;
  top: string;
}

/**
 * 그라운드 라벨·주루 좌표 — object-contain + 이미지 정규 좌표 (stadiumFieldCoords.ts)
 */
export const FIELD_POSITIONS: Record<PredictionOption, FieldPoint> = {
  홈런: { left: "50%", top: "11%" },
  "3루": { left: "28%", top: "36%" },
  "2루": { left: "50%", top: "41%" },
  "1루": { left: "72%", top: "50%" },
  아웃: { left: "50%", top: "86%" },
};

export const HOME_PLATE = FIELD_POSITIONS.아웃;

/** 투수 마운드 — 발 위치 (시안) */
export const PITCHERS_MOUND: FieldPoint = { left: "50%", top: "50%" };

export type DefenseRole = "P" | "C" | "1B" | "2B" | "3B" | "SS" | "LF" | "CF" | "RF";

export interface DefensePosition {
  role: DefenseRole;
  point: FieldPoint;
  /** 필드 방향(deg) — SVG 캐릭터 회전 */
  facing?: number;
}

/** 수비 포지션 (% 기준) — 라벨·베이스와 겹치지 않게 약간 오프셋 */
export const DEFENSE_POSITIONS: DefensePosition[] = [
  { role: "P", point: PITCHERS_MOUND, facing: 0 },
  { role: "C", point: { left: "50%", top: "90%" }, facing: 0 },
  { role: "1B", point: { left: "75%", top: "48%" }, facing: -25 },
  { role: "2B", point: { left: "52%", top: "38%" }, facing: 0 },
  { role: "3B", point: { left: "25%", top: "38%" }, facing: 25 },
  { role: "SS", point: { left: "37%", top: "44%" }, facing: 15 },
  { role: "LF", point: { left: "21%", top: "17%" }, facing: 20 },
  { role: "CF", point: { left: "50%", top: "8%" }, facing: 0 },
  { role: "RF", point: { left: "79%", top: "17%" }, facing: -20 },
];

export type TeamSide = "home" | "away";

/** 내야 수비만 표시 (외야 3명 제외 — 필드가 덜 복잡하게) */
export const INFIELD_DEFENSE_POSITIONS: DefensePosition[] = DEFENSE_POSITIONS.filter(
  (p) => p.role !== "LF" && p.role !== "CF" && p.role !== "RF",
);

/** 초=원정 공격 → 홈 수비(붉은 유니폼), 말=홈 공격 → 원정 수비(하얀 유니폼) */
export function defendingSideFromInningHalf(half: "top" | "bottom" | undefined): TeamSide {
  return half === "bottom" ? "away" : "home";
}

export const FIELD_LABEL_TEXT: Record<PredictionOption, string> = {
  홈런: "홈런",
  "3루": "3루",
  "2루": "2루",
  "1루": "1루",
  아웃: "아웃",
};

/** 베이스 간 주루 시간(초). 실제 타구 후 1루 도달 약 4초 — UI는 3.5초/베이스 */
export const RUN_SECONDS_PER_BASE = 3.5;

/** 홈런 성공 시 배트 토스 연출 시간(ms) — 주루 시작 전 */
export const HOME_RUN_BAT_TOSS_MS = 1200;

/** 예측 결과(1루·2루·3루·홈런)에 따른 주루 애니메이션 총 시간(초) */
export function getRunDurationSec(target: PredictionOption): number {
  const segments = Math.max(1, getRunPathImagePoints(target).length - 1);
  return segments * RUN_SECONDS_PER_BASE;
}
