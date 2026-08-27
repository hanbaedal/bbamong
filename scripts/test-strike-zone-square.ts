/**
 * 스트라이크존 정사각형·16% 확대·홈플레이트와 겹치지 않음
 * 실행: npx tsx scripts/test-strike-zone-square.ts
 */
import {
  computeStrikeZoneLayout,
  STRIKE_ZONE_PLATE_CLEARANCE_RATIO,
  STRIKE_ZONE_SIZE_BOOST,
} from "../client/src/components/game/strikeZoneLayout";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const fieldW = 800;
const fieldH = 450;
const homeTop = fieldH * 0.9;
const prevW = Math.min(fieldW * 0.11, 92) * 0.9 * 0.84;
const { zoneW, zoneH, top, plateGap } = computeStrikeZoneLayout(fieldW, fieldH, homeTop, false);

assert(Math.abs(STRIKE_ZONE_SIZE_BOOST - 1.16) < 1e-9, `확대 배율 ${STRIKE_ZONE_SIZE_BOOST}`);
assert(Math.abs(zoneW / prevW - STRIKE_ZONE_SIZE_BOOST) < 1e-9, `폭 16% 확대 ${zoneW}/${prevW}`);
assert(zoneH === zoneW, `정사각형 ${zoneW}x${zoneH}`);
assert(zoneW > 40 && zoneW < 95, `합리적 크기 ${zoneW}`);

assert(plateGap >= fieldH * STRIKE_ZONE_PLATE_CLEARANCE_RATIO, `플레이트 간격 ${plateGap}`);
assert(top + zoneH <= homeTop - plateGap + 1e-9, `존 하단이 홈과 겹침 top=${top} h=${zoneH} home=${homeTop}`);
assert(top + zoneH < homeTop, "존 하단이 홈플레이트 포인트보다 위");

const cine = computeStrikeZoneLayout(fieldW, fieldH, homeTop, true);
assert(Math.abs(cine.zoneW / zoneW - 1.35) < 1e-9, `시네마틱 확대 ${cine.zoneW}/${zoneW}`);
assert(cine.top + cine.zoneH < homeTop, "시네마틱 존도 홈과 안 겹침");
assert(cine.top < top, "시네마틱 존이 더 큼 → 상단이 더 위");

console.log("OK: strike zone +16% and above home plate", {
  prevW,
  zoneW,
  zoneH,
  top,
  plateGap,
  homeTop,
  cineW: cine.zoneW,
  cineTop: cine.top,
});
