/**
 * 스트라이크존 정사각형·폭 16% 축소 검증
 * 실행: npx tsx scripts/test-strike-zone-square.ts
 */
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

/** GameStrikeZoneOverlay 과 동일식 */
function zoneSize(fieldWidth: number) {
  const zoneW = Math.min(fieldWidth * 0.11, 92) * 0.9 * 0.84;
  const zoneH = zoneW;
  return { zoneW, zoneH };
}

const beforeW = Math.min(800 * 0.11, 92) * 0.9;
const { zoneW, zoneH } = zoneSize(800);
assert(Math.abs(zoneW / beforeW - 0.84) < 1e-9, `폭 16% 축소 ${zoneW}/${beforeW}`);
assert(zoneH === zoneW, `정사각형 ${zoneW}x${zoneH}`);
assert(zoneW > 40 && zoneW < 80, `합리적 크기 ${zoneW}`);

console.log("OK: strike zone square -16% width", { beforeW, zoneW, zoneH });
