/** 기존 정사각 존 대비 16% 확대 */
export const STRIKE_ZONE_SIZE_BOOST = 1.16;

/**
 * 시네마틱 투구 사진에서 존 하단의 이미지 Y.
 * 홈플레이트 오각형 앞전은 약 0.825 — 그보다 위에 두어 겹치지 않게 한다.
 */
export const CINEMATIC_ZONE_BOTTOM_Y = 0.76;

/** 필드 구장(비시네마틱)에서 플레이트 포인트와 존 하단 사이 화면 높이 비율 */
export const FIELD_ZONE_PLATE_CLEARANCE_RATIO = 0.04;

const STRIKE_ZONE_BASE = 0.9 * 0.84;
const CINEMATIC_ZONE_SCALE = 1.35;

export function computeStrikeZoneSize(
  fieldWidth: number,
  cinematic = false,
): { zoneW: number; zoneH: number } {
  const zoneScale = cinematic ? CINEMATIC_ZONE_SCALE : 1;
  const zoneW = Math.min(fieldWidth * 0.11, 92) * STRIKE_ZONE_BASE * zoneScale * STRIKE_ZONE_SIZE_BOOST;
  return { zoneW, zoneH: zoneW };
}

/** 시네마틱은 이미지 Y=0.76에 존 하단. 필드는 홈 포인트 위로 띄움. */
export function computeStrikeZoneTop(opts: {
  homeTop: number;
  zoneBottomTop: number;
  zoneH: number;
  fieldHeight: number;
  cinematic: boolean;
}): number {
  if (opts.cinematic) {
    return opts.zoneBottomTop - opts.zoneH;
  }
  const plateGap = Math.max(opts.fieldHeight * FIELD_ZONE_PLATE_CLEARANCE_RATIO, 12);
  return opts.homeTop - opts.zoneH - plateGap;
}
