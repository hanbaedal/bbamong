/**
 * 우타=좌측·좌타=우측 타석 박스 — 홈 기준 반대편·존과 적정 간격
 * 실행: npx tsx scripts/test-batter-box-sides.ts
 */
import {
  BATTER_BOX_LEFT_IMAGE,
  BATTER_BOX_OFFSET_X,
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
assert(Math.abs(gapL - BATTER_BOX_OFFSET_X) < 1e-9, `우타 오프셋 ${gapL}`);
assert(Math.abs(gapR - BATTER_BOX_OFFSET_X) < 1e-9, `좌타 오프셋 ${gapR}`);
// 존과 안 겹치되 과하게 멀지 않게 (0.225는 과함)
assert(gapL >= 0.03 && gapL <= 0.08, `우타 간격 ${gapL} (기대 0.03~0.08)`);
assert(gapR >= 0.03 && gapR <= 0.08, `좌타 간격 ${gapR} (기대 0.03~0.08)`);

console.log("OK: batter box closer to zone without overlap", {
  offset: BATTER_BOX_OFFSET_X,
  gapL,
  gapR,
});
