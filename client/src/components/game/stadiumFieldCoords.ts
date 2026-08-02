import type { PredictionOption } from "./gameTypes";

/** game-stadium-bg.png 원본 크기 (중앙 필드 — 3:2) */
export const STADIUM_IMAGE = { width: 1536, height: 1024 } as const;

/** 원본 경기장 PNG 비율 (1536×1024 = 3:2) */
export const STADIUM_ASPECT_RATIO = STADIUM_IMAGE.width / STADIUM_IMAGE.height;

/** @deprecated 미러 확장 레이아웃에서는 미사용 */
export const STADIUM_OBJECT_POSITION = { x: 0.5, y: 1 } as const;

/** 0~1 정규화 좌표 (원본 1536×1024 픽셀 기준) */
export interface ImagePoint {
  x: number;
  y: number;
}

/**
 * 하단 날짜(text-[10px]) 한 줄 ≈ 화면 높이 대비 비율.
 * 랜드스케이프 기준 높이 ~400px → 10/400 = 0.025
 */
const DATE_LINE_Y = 0.025;

/** 날짜 글자 1자 ≈ 10px — 6글자 가로 이동 (1536px 이미지 기준) */
const DATE_LINE_X = (10 / STADIUM_IMAGE.width) * 6;

/** 조정 전 좌표 (이동량 계산용) */
const PREV_IMAGE_POINTS = {
  아웃: { x: 0.5, y: 0.845 },
  "1루": { x: 0.705, y: 0.595 },
  "2루": { x: 0.5, y: 0.435 },
  "3루": { x: 0.295, y: 0.595 },
  홈런: { x: 0.5, y: 0.175 },
} as const;

/**
 * 야구장 PNG 위 베이스·홈플레이트 위치 (1536×1024 기준)
 * 한 줄·6글자 기준 = 하단 날짜(text-[10px]) 크기
 * - 아웃: +1줄 / 2루: +2줄 / 홈런: 이전 2루 자리
 * - 1루: +1줄, +6글자(오른쪽) / 3루: +1줄, -6글자(왼쪽)
 */
export const BASE_IMAGE_POINTS: Record<PredictionOption, ImagePoint> = {
  아웃: { x: 0.5, y: PREV_IMAGE_POINTS.아웃.y + DATE_LINE_Y },
  "1루": {
    x: PREV_IMAGE_POINTS["1루"].x + DATE_LINE_X,
    y: PREV_IMAGE_POINTS["1루"].y + DATE_LINE_Y,
  },
  "2루": { x: PREV_IMAGE_POINTS["2루"].x, y: PREV_IMAGE_POINTS["2루"].y + DATE_LINE_Y * 2 },
  "3루": {
    x: PREV_IMAGE_POINTS["3루"].x - DATE_LINE_X,
    y: PREV_IMAGE_POINTS["3루"].y + DATE_LINE_Y,
  },
  홈런: { x: 0.5, y: PREV_IMAGE_POINTS["2루"].y },
};

/** 경기 시작 전 대기 — 3루 위치 */
export const STANDS_SEAT_IMAGE: ImagePoint = { ...BASE_IMAGE_POINTS["3루"] };

export const HOME_PLATE_IMAGE = BASE_IMAGE_POINTS.아웃;
export const PITCHER_MOUND_IMAGE: ImagePoint = { x: 0.5, y: 0.535 };

const IMAGE_ASPECT = STADIUM_IMAGE.width / STADIUM_IMAGE.height;

/**
 * 중앙 3:2 이미지(높이 100%) + 좌우 미러 여백 레이아웃 좌표 변환
 */
export function stadiumImagePointToPx(
  point: ImagePoint,
  containerW: number,
  containerH: number,
): { left: number; top: number } {
  if (containerW <= 0 || containerH <= 0) {
    return { left: 0, top: 0 };
  }

  const { width: iw, height: ih } = STADIUM_IMAGE;
  const imageAspect = iw / ih;
  const containerAspect = containerW / containerH;

  let contentW: number;
  let contentH: number;
  let offsetX: number;
  let offsetY: number;

  if (containerAspect >= imageAspect) {
    contentH = containerH;
    contentW = containerH * imageAspect;
    offsetX = (containerW - contentW) / 2;
    offsetY = 0;
  } else {
    contentW = containerW;
    contentH = containerW / imageAspect;
    offsetX = 0;
    offsetY = (containerH - contentH) / 2;
  }

  return {
    left: offsetX + point.x * contentW,
    top: offsetY + point.y * contentH,
  };
}

/** @deprecated stadiumImagePointToPx 사용 */
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
