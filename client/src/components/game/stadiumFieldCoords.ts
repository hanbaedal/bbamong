import type { PredictionOption } from "./gameTypes";

/** game-stadium-field.jpg 원본 크기 (1560×720 ≈ 19.5:9) */
export const STADIUM_IMAGE = { width: 1560, height: 720 } as const;

/** 필드 구장 JPG 비율 — object-cover 로 뷰포트를 채움 */
export const STADIUM_ASPECT_RATIO = STADIUM_IMAGE.width / STADIUM_IMAGE.height;

/** @deprecated 미러 확장 레이아웃에서는 미사용 */
export const STADIUM_OBJECT_POSITION = { x: 0.5, y: 1 } as const;

/** 0~1 정규화 좌표 (game-stadium-field.jpg 픽셀 기준) */
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
 * 3D 구장 JPG(game-stadium-field.jpg 1560×720) 위 베이스·버튼 위치
 * 홈플레이트·베이스백 실측. 홈런은 중견 펜스 앞.
 */
export const BASE_IMAGE_POINTS: Record<PredictionOption, ImagePoint> = {
  아웃: { x: 0.49, y: 0.835 },
  "1루": { x: 0.796, y: 0.563 },
  "2루": { x: 0.491, y: 0.418 },
  "3루": { x: 0.18, y: 0.553 },
  홈런: { x: 0.491, y: 0.22 },
};

/** 경기 시작 전 대기 — 3루 위치 */
export const STANDS_SEAT_IMAGE: ImagePoint = { ...BASE_IMAGE_POINTS["3루"] };

export const HOME_PLATE_IMAGE = BASE_IMAGE_POINTS.아웃;
export const PITCHER_MOUND_IMAGE: ImagePoint = { x: 0.491, y: 0.59 };

/**
 * scene-running.jpg (1560×720) — 포수 뒤 실사 구장. 홈은 화면 가운데 아래.
 * (예전 고각 3루측 좌표는 주루가 왼쪽으로 빠지는 오류를 냈다.)
 */
export const RUNNING_BASE_IMAGE_POINTS: Record<PredictionOption, ImagePoint> = {
  아웃: { x: 0.5, y: 0.86 },
  "1루": { x: 0.8, y: 0.6 },
  "2루": { x: 0.5, y: 0.38 },
  "3루": { x: 0.2, y: 0.6 },
  홈런: { x: 0.5, y: 0.18 },
};

export const RUNNING_HOME_PLATE_IMAGE = RUNNING_BASE_IMAGE_POINTS.아웃;

export function baseImagePointsForRunning(running: boolean): Record<PredictionOption, ImagePoint> {
  return running ? RUNNING_BASE_IMAGE_POINTS : BASE_IMAGE_POINTS;
}

export function homePlateImageForRunning(running: boolean): ImagePoint {
  return running ? RUNNING_HOME_PLATE_IMAGE : HOME_PLATE_IMAGE;
}

/** 타석 박스 — 홈플레이트 좌우 타석 라인 (이미지 폭 비율) */
export const BATTER_BOX_OFFSET_X = 0.045;

/** 우타 박스 — 홈·스트라이크존 왼쪽(화면 좌측) */
export const BATTER_BOX_RIGHT_IMAGE: ImagePoint = {
  x: HOME_PLATE_IMAGE.x - BATTER_BOX_OFFSET_X,
  y: HOME_PLATE_IMAGE.y - 0.008,
};

/** 좌타 박스 — 홈·스트라이크존 오른쪽(화면 우측) */
export const BATTER_BOX_LEFT_IMAGE: ImagePoint = {
  x: HOME_PLATE_IMAGE.x + BATTER_BOX_OFFSET_X,
  y: HOME_PLATE_IMAGE.y - 0.008,
};

/**
 * 예측 대기(wait_start) 좌타 — 포수 오른쪽(1루쪽). 필드 폴백용.
 */
export const WAIT_LEFT_HANDED_BOX_IMAGE: ImagePoint = BATTER_BOX_LEFT_IMAGE;

/** object-cover + scale-x 미러와 같은 정규화 X */
export function maybeMirrorImagePointX(point: ImagePoint, mirrorX: boolean): ImagePoint {
  return mirrorX ? { x: 1 - point.x, y: point.y } : point;
}

/** scene-pitch-*.jpg · scene-wait-*.jpg (16:9). 필드 JPG(1560×720)와 섞지 않는다. */
export const CINEMATIC_SCENE_IMAGE = { width: 1280, height: 720 } as const;

/** pitch_home — 전경 홈플레이트(1280×720 정규화) */
export const PITCH_HOME_PLATE_IMAGE: ImagePoint = { x: 0.5, y: 0.9 };

/** pitch_away — 전경 홈플레이트 */
export const PITCH_AWAY_PLATE_IMAGE: ImagePoint = { x: 0.48, y: 0.89 };

/**
 * object-cover 레이아웃 좌표 변환 — CSS object-cover / object-position center 와 동일
 */
export function stadiumImagePointToPx(
  point: ImagePoint,
  containerW: number,
  containerH: number,
  image: { width: number; height: number } = STADIUM_IMAGE,
): { left: number; top: number } {
  if (containerW <= 0 || containerH <= 0) {
    return { left: 0, top: 0 };
  }

  const { width: iw, height: ih } = image;
  const imageAspect = iw / ih;
  const containerAspect = containerW / containerH;

  let contentW: number;
  let contentH: number;
  let offsetX: number;
  let offsetY: number;

  if (containerAspect > imageAspect) {
    contentW = containerW;
    contentH = containerW / imageAspect;
    offsetX = 0;
    offsetY = (containerH - contentH) / 2;
  } else {
    contentH = containerH;
    contentW = containerH * imageAspect;
    offsetX = (containerW - contentW) / 2;
    offsetY = 0;
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

export function getRunPathImagePoints(
  target: PredictionOption,
  bases: Record<PredictionOption, ImagePoint> = BASE_IMAGE_POINTS,
): ImagePoint[] {
  const home = bases.아웃;
  const first = bases["1루"];
  const second = bases["2루"];
  const third = bases["3루"];

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
