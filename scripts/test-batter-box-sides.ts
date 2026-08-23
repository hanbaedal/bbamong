/**
 * 우타=좌측·좌타=우측 타석 박스 — 홈 기준 반대편에 있는지
 * 실행: npx tsx scripts/test-batter-box-sides.ts
 */
import {
  BATTER_BOX_LEFT_IMAGE,
  BATTER_BOX_RIGHT_IMAGE,
  HOME_PLATE_IMAGE,
} from "../client/src/components/game/stadiumFieldCoords";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

// 우타 박스 = BATTER_BOX_RIGHT (오른손 타자) → 화면 왼쪽 (x < home)
assert(BATTER_BOX_RIGHT_IMAGE.x < HOME_PLATE_IMAGE.x, "우타 박스는 홈 왼쪽");
// 좌타 박스 = BATTER_BOX_LEFT → 화면 오른쪽 (x > home)
assert(BATTER_BOX_LEFT_IMAGE.x > HOME_PLATE_IMAGE.x, "좌타 박스는 홈 오른쪽");

const gapL = HOME_PLATE_IMAGE.x - BATTER_BOX_RIGHT_IMAGE.x;
const gapR = BATTER_BOX_LEFT_IMAGE.x - HOME_PLATE_IMAGE.x;
assert(gapL >= 0.2, `우타 간격 ${gapL}`);
assert(gapR >= 0.2, `좌타 간격 ${gapR}`);

console.log("OK: batter box sides (우타=좌, 좌타=우, 존과 간격)");
