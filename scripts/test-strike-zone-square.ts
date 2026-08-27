/**
 * 스트라이크존 정사각형·16% 확대·홈플레이트와 겹치지 않음
 * 실행: npx tsx scripts/test-strike-zone-square.ts
 */
import {
  CINEMATIC_ZONE_BOTTOM_Y,
  computeStrikeZoneSize,
  computeStrikeZoneTop,
  STRIKE_ZONE_SIZE_BOOST,
} from "../client/src/components/game/strikeZoneLayout";
import {
  CINEMATIC_SCENE_IMAGE,
  PITCH_HOME_PLATE_IMAGE,
  stadiumImagePointToPx,
} from "../client/src/components/game/stadiumFieldCoords";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const fieldW = 800;
const fieldH = 450;
const prevW = Math.min(fieldW * 0.11, 92) * 0.9 * 0.84;
const { zoneW, zoneH } = computeStrikeZoneSize(fieldW, false);
const cine = computeStrikeZoneSize(fieldW, true);

assert(Math.abs(STRIKE_ZONE_SIZE_BOOST - 1.16) < 1e-9, `확대 배율 ${STRIKE_ZONE_SIZE_BOOST}`);
assert(Math.abs(zoneW / prevW - STRIKE_ZONE_SIZE_BOOST) < 1e-9, `폭 16% 확대 ${zoneW}/${prevW}`);
assert(zoneH === zoneW, `정사각형 ${zoneW}x${zoneH}`);
assert(zoneW > 40 && zoneW < 95, `합리적 크기 ${zoneW}`);
assert(Math.abs(cine.zoneW / zoneW - 1.35) < 1e-9, `시네마틱 확대 ${cine.zoneW}/${zoneW}`);

const plateFrontY = 0.825;
assert(CINEMATIC_ZONE_BOTTOM_Y < plateFrontY, `존 하단 ${CINEMATIC_ZONE_BOTTOM_Y} >= 플레이트 앞전 ${plateFrontY}`);

const homePx = stadiumImagePointToPx(PITCH_HOME_PLATE_IMAGE, fieldW, fieldH, CINEMATIC_SCENE_IMAGE);
const bottomPx = stadiumImagePointToPx(
  { x: PITCH_HOME_PLATE_IMAGE.x, y: CINEMATIC_ZONE_BOTTOM_Y },
  fieldW,
  fieldH,
  CINEMATIC_SCENE_IMAGE,
);
const plateFrontPx = stadiumImagePointToPx(
  { x: PITCH_HOME_PLATE_IMAGE.x, y: plateFrontY },
  fieldW,
  fieldH,
  CINEMATIC_SCENE_IMAGE,
);
const cineTop = computeStrikeZoneTop({
  homeTop: homePx.top,
  zoneBottomTop: bottomPx.top,
  zoneH: cine.zoneH,
  fieldHeight: fieldH,
  cinematic: true,
});
const cineBottom = cineTop + cine.zoneH;
assert(cineBottom <= bottomPx.top + 1e-9, `시네마틱 존 하단 ${cineBottom} > 앵커 ${bottomPx.top}`);
assert(cineBottom < plateFrontPx.top, `시네마틱 존이 홈플레이트와 겹침 ${cineBottom} vs plate ${plateFrontPx.top}`);
assert(cineTop < cineBottom, "존 높이 양수");

const fieldHomeTop = fieldH * 0.835;
const fieldTop = computeStrikeZoneTop({
  homeTop: fieldHomeTop,
  zoneBottomTop: fieldHomeTop,
  zoneH,
  fieldHeight: fieldH,
  cinematic: false,
});
assert(fieldTop + zoneH < fieldHomeTop, "필드 존도 홈 포인트보다 위");

console.log("OK: strike zone +16% and above home plate", {
  prevW,
  zoneW,
  cineW: cine.zoneW,
  cineTop,
  cineBottom,
  plateFrontTop: plateFrontPx.top,
  gapPx: plateFrontPx.top - cineBottom,
  zoneBottomY: CINEMATIC_ZONE_BOTTOM_Y,
});
