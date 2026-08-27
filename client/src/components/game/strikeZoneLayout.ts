/** 기존 정사각 존 대비 16% 확대 */
export const STRIKE_ZONE_SIZE_BOOST = 1.16;

/** 홈플레이트 오각형이 화면 하단 ~10–15%를 차지하므로, 존 하단을 그 위로 띄운다 */
export const STRIKE_ZONE_PLATE_CLEARANCE_RATIO = 0.055;

const STRIKE_ZONE_BASE = 0.9 * 0.84;
const CINEMATIC_ZONE_SCALE = 1.35;

export function computeStrikeZoneLayout(
  fieldWidth: number,
  fieldHeight: number,
  homeTop: number,
  cinematic = false,
): { zoneW: number; zoneH: number; top: number; plateGap: number } {
  const zoneScale = cinematic ? CINEMATIC_ZONE_SCALE : 1;
  const zoneW = Math.min(fieldWidth * 0.11, 92) * STRIKE_ZONE_BASE * zoneScale * STRIKE_ZONE_SIZE_BOOST;
  const zoneH = zoneW;
  const plateGap = Math.max(fieldHeight * STRIKE_ZONE_PLATE_CLEARANCE_RATIO, 16);
  return {
    zoneW,
    zoneH,
    top: homeTop - zoneH - plateGap,
    plateGap,
  };
}
