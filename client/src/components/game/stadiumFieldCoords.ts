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

/** 조정 전 좌표 (레거시 — PNG 실측으로 대체) */
const PREV_IMAGE_POINTS = {
  아웃: { x: 0.5, y: 0.845 },
  "1루": { x: 0.705, y: 0.595 },
  "2루": { x: 0.5, y: 0.435 },
  "3루": { x: 0.295, y: 0.595 },
  홈런: { x: 0.5, y: 0.175 },
} as const;

/**
 * 야구장 PNG(game-stadium-bg.png 1536×1024) 위 베이스·버튼 위치
 * - 홈·2루: PNG 밝기 피크 (0.499/0.892, 0.501/0.631)
 * - 1·3루: 파울라인 더트 위 베이스백 — y≈0.71 (기존 y≈0.60대는 마운드 쪽이라 항상 어긋남)
 */
export const BASE_IMAGE_POINTS: Record<PredictionOption, ImagePoint> = {
  아웃: { x: 0.5, y: 0.89 },
  "1루": { x: 0.835, y: 0.708 },
  "2루": { x: 0.5, y: 0.631 },
  "3루": { x: 0.158, y: 0.718 },
  홈런: { x: 0.5, y: 0.435 },
};

/** 경기 시작 전 대기 — 3루 위치 */
export const STANDS_SEAT_IMAGE: ImagePoint = { ...BASE_IMAGE_POINTS["3루"] };

export const HOME_PLATE_IMAGE = BASE_IMAGE_POINTS.아웃;
export const PITCHER_MOUND_IMAGE: ImagePoint = { x: 0.5, y: 0.535 };

/** 우타 박스 — 홈·스트라이크존 왼쪽(화면 좌측). 존 점과 안 겹치게 벌림 */
export const BATTER_BOX_RIGHT_IMAGE: ImagePoint = {
  x: HOME_PLATE_IMAGE.x - 0.225,
  y: HOME_PLATE_IMAGE.y - 0.008,
};

/** 좌타 박스 — 홈·스트라이크존 오른쪽(화면 우측) */
export const BATTER_BOX_LEFT_IMAGE: ImagePoint = {
  x: HOME_PLATE_IMAGE.x + 0.225,
  y: HOME_PLATE_IMAGE.y - 0.008,
};

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
      // 홈 → 1 → 2 → 3 → 홈플레이트 (홈런 버튼 위치가 아님)
      return [home, first, second, third, home];
    default:
      return [home];
  }
}

/**
 * 주루 진행률(0~1)에서 현재 구간이 오른쪽으로 가는지.
 * 스프라이트 기본 방향이 우측이므로 true면 scaleX(1), false면 scaleX(-1).
 */
export function getRunFacingRight(points: ImagePoint[], progress01: number): boolean {
  if (points.length < 2) return true;
  const segments = points.length - 1;
  const t = Math.min(0.999, Math.max(0, progress01)) * segments;
  let i = Math.min(segments - 1, Math.floor(t));
  let dx = points[i + 1].x - points[i].x;
  // 거의 수직 구간이면 앞/뒤 수평 구간을 참고
  if (Math.abs(dx) < 0.02) {
    for (let j = i + 1; j < segments; j++) {
      const ndx = points[j + 1].x - points[j].x;
      if (Math.abs(ndx) >= 0.02) {
        dx = ndx;
        break;
      }
    }
    if (Math.abs(dx) < 0.02) {
      for (let j = i - 1; j >= 0; j--) {
        const pdx = points[j + 1].x - points[j].x;
        if (Math.abs(pdx) >= 0.02) {
          dx = pdx;
          break;
        }
      }
    }
  }
  return dx >= 0;
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
