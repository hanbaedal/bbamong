import type { PredictionOption } from "./gameTypes";

export interface FieldPoint {
  left: string;
  top: string;
}

/** 그라운드 라벨·캐릭터 이동 좌표 (% 기준) — 나중에 미세 조정 */
export const FIELD_POSITIONS: Record<PredictionOption, FieldPoint> = {
  홈런: { left: "58%", top: "18%" },
  "3루": { left: "72%", top: "38%" },
  "2루": { left: "58%", top: "48%" },
  "1루": { left: "72%", top: "58%" },
  아웃: { left: "50%", top: "68%" },
};

export const HOME_PLATE = FIELD_POSITIONS.아웃;

export const FIELD_LABEL_TEXT: Record<PredictionOption, string> = {
  홈런: "홈런",
  "3루": "3",
  "2루": "2",
  "1루": "1",
  아웃: "아웃",
};

/** 베이스 경유 달리기 경로 (홈에서 출발) */
export function getRunPath(target: PredictionOption): FieldPoint[] {
  const home = HOME_PLATE;
  const first = FIELD_POSITIONS["1루"];
  const second = FIELD_POSITIONS["2루"];
  const third = FIELD_POSITIONS["3루"];
  const hr = FIELD_POSITIONS.홈런;

  switch (target) {
    case "아웃":
      return [home];
    case "1루":
      return [home, first];
    case "2루":
      return [home, first, second];
    case "3루":
      return [home, first, second, third];
    case "홈런":
      return [home, first, second, third, hr];
    default:
      return [home];
  }
}

export function pathToCssKeyframes(name: string, points: FieldPoint[]): string {
  if (points.length <= 1) {
    const p = points[0] ?? HOME_PLATE;
    return `
      @keyframes ${name} {
        0%, 100% { left: ${p.left}; top: ${p.top}; }
      }
    `;
  }
  const steps = points.map((p, i) => {
    const pct = Math.round((i / (points.length - 1)) * 100);
    return `${pct}% { left: ${p.left}; top: ${p.top}; }`;
  });
  return `@keyframes ${name} { ${steps.join(" ")} }`;
}
