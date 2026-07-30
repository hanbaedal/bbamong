import type { PredictionOption } from "./gameTypes";

/** game-stadium-bg.png 원본 크기 */
export const STADIUM_IMAGE = { width: 1536, height: 1024 } as const;

/** GameFieldViewport 배경 object-position — contain + center 기본 */
export const STADIUM_OBJECT_POSITION = { x: 0.5, y: 0.5 } as const;

/** 0~1 정규화 좌표 (이미지 픽셀 기준) */
export interface ImagePoint {
  x: number;
  y: number;
}

/**
 * 야구장 PNG 위 베이스·홈플레이트 위치 (1536×1024 기준)
 * — 홈(아웃), 1·2·3루 베이스, 중견 홈런
 */
export const BASE_IMAGE_POINTS: Record<PredictionOption, ImagePoint> = {
  아웃: { x: 0.5, y: 0.845 },
  "1루": { x: 0.705, y: 0.595 },
  "2루": { x: 0.5, y: 0.435 },
  "3루": { x: 0.295, y: 0.595 },
  홈런: { x: 0.5, y: 0.175 },
};

export const HOME_PLATE_IMAGE = BASE_IMAGE_POINTS.아웃;
export const PITCHER_MOUND_IMAGE: ImagePoint = { x: 0.5, y: 0.535 };

/** object-contain + object-position 과 동일한 좌표 변환 */
export function stadiumImagePointToPx(
  point: ImagePoint,
  containerW: number,
  containerH: number,
): { left: number; top: number } {
  if (containerW <= 0 || containerH <= 0) {
    return { left: 0, top: 0 };
  }

  const { width: iw, height: ih } = STADIUM_IMAGE;
  const scale = Math.min(containerW / iw, containerH / ih);
  const renderedW = iw * scale;
  const renderedH = ih * scale;
  const offsetX = STADIUM_OBJECT_POSITION.x * (containerW - renderedW);
  const offsetY = STADIUM_OBJECT_POSITION.y * (containerH - renderedH);

  return {
    left: offsetX + point.x * renderedW,
    top: offsetY + point.y * renderedH,
  };
}

/** @deprecated contain 기준으로 통일 — stadiumImagePointToPx 사용 */
export const coverImagePointToPx = stadiumImagePointToPx;

export function stadiumImagePointToPercent(
  point: ImagePoint,
  containerW: number,
  containerH: number,
): { left: string; top: string } {
  const { left, top } = stadiumImagePointToPx(point, containerW, containerH);
  return {
    left: `${(left / containerW) * 100}%`,
    top: `${(top / containerH) * 100}%`,
  };
}

/** 주루 경로 (홈 출발) */
export function getRunPathImagePoints(target: PredictionOption): ImagePoint[] {
  const home = HOME_PLATE_IMAGE;
  const first = BASE_IMAGE_POINTS["1루"];
  const second = BASE_IMAGE_POINTS["2루"];
  const third = BASE_IMAGE_POINTS["3루"];
  const hr = BASE_IMAGE_POINTS.홈런;

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

export function pathToCssKeyframesPx(
  name: string,
  points: ImagePoint[],
  containerW: number,
  containerH: number,
): string {
  if (points.length <= 1) {
    const p = stadiumImagePointToPx(points[0] ?? HOME_PLATE_IMAGE, containerW, containerH);
    return `@keyframes ${name} { 0%, 100% { left: ${p.left}px; top: ${p.top}px; } }`;
  }

  const steps = points.map((pt, i) => {
    const p = stadiumImagePointToPx(pt, containerW, containerH);
    const pct = Math.round((i / (points.length - 1)) * 100);
    return `${pct}% { left: ${p.left}px; top: ${p.top}px; }`;
  });
  return `@keyframes ${name} { ${steps.join(" ")} }`;
}
