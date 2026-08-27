/** 기존 정사각 존 대비 16% 확대 */
export const STRIKE_ZONE_SIZE_BOOST = 1.16;

/** 시네마틱 전경 플레이트의 앞전(투수 쪽)이 포인트보다 위에 있으므로 화면 높이의 10%를 띄운다 */
export const STRIKE_ZONE_PLATE_CLEARANCE_RATIO = 0.1;

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
