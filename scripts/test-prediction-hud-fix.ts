/**
 * 예측 HUD: 원정 청 / 홈 백, 시네마틱 플레이트, 대기 좌타 홈 왼쪽
 * 실행: npx tsx scripts/test-prediction-hud-fix.ts
 */
import { GAME_AWAY_TEAM_COLOR, GAME_HOME_TEAM_COLOR } from "../client/src/components/game/gameHudColors";
import { resolveGameSceneKind } from "../client/src/components/game/gameSceneBackground";
import {
  BATTER_BOX_RIGHT_IMAGE,
  CINEMATIC_SCENE_IMAGE,
  HOME_PLATE_IMAGE,
  PITCH_AWAY_PLATE_IMAGE,
  PITCH_HOME_PLATE_IMAGE,
  STADIUM_IMAGE,
  WAIT_LEFT_HANDED_BOX_IMAGE,
  stadiumImagePointToPx,
} from "../client/src/components/game/stadiumFieldCoords";
import { isMongoTransientError } from "../shared/mongoTransientError";
import { WS_MANAGER_CLIENT_HEARTBEAT_INTERVAL_MS } from "../shared/wsHeartbeat";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(GAME_AWAY_TEAM_COLOR === "#1A6DFF", "away score blue");
assert(GAME_HOME_TEAM_COLOR === "#FFFFFF", "home score white");
assert(!/#E11936/i.test(GAME_AWAY_TEAM_COLOR), "away is not red");

assert(CINEMATIC_SCENE_IMAGE.width === 1280, "pitch photos 1280");
assert(CINEMATIC_SCENE_IMAGE.height === 720, "pitch photos 720");
assert(PITCH_HOME_PLATE_IMAGE.y > 0.8, "pitch home plate in foreground");
assert(PITCH_AWAY_PLATE_IMAGE.y > 0.8, "pitch away plate in foreground");
assert(PITCH_HOME_PLATE_IMAGE.x > 0.4 && PITCH_HOME_PLATE_IMAGE.x < 0.6, "pitch home plate near center");

assert(WAIT_LEFT_HANDED_BOX_IMAGE.x < HOME_PLATE_IMAGE.x, "wait lefty is left of plate");
assert(WAIT_LEFT_HANDED_BOX_IMAGE.x === BATTER_BOX_RIGHT_IMAGE.x, "wait lefty uses left box");

const field16x9 = stadiumImagePointToPx(HOME_PLATE_IMAGE, 1600, 900);
const pitch16x9 = stadiumImagePointToPx(
  PITCH_HOME_PLATE_IMAGE,
  1600,
  900,
  CINEMATIC_SCENE_IMAGE,
);
assert(pitch16x9.left !== field16x9.left || pitch16x9.top !== field16x9.top, "cinematic plate mapping differs");
assert(STADIUM_IMAGE.width !== CINEMATIC_SCENE_IMAGE.width, "field vs cinematic aspect");

assert(
  resolveGameSceneKind({
    gameDayPhase: "live",
    screenPhase: "wait_start",
    inningHalf: "bottom",
    batsSide: "left",
  }) === "field",
  "home lefty wait uses field",
);
assert(
  resolveGameSceneKind({
    gameDayPhase: "live",
    screenPhase: "wait_start",
    inningHalf: "top",
    batsSide: "left",
  }) === "wait_away",
  "away lefty wait keeps away photo (mirrored)",
);
assert(
  resolveGameSceneKind({
    gameDayPhase: "live",
    screenPhase: "wait_start",
    inningHalf: "bottom",
    batsSide: "right",
  }) === "wait_home",
  "home righty wait uses wait_home",
);
assert(
  resolveGameSceneKind({
    gameDayPhase: "live",
    screenPhase: "wait_result",
    inningHalf: "bottom",
  }) === "pitch_home",
  "wait_result uses pitch photo",
);

assert(isMongoTransientError({ code: 112 }), "WriteConflict 112");
assert(isMongoTransientError({ errorLabels: ["TransientTransactionError"] }), "transient label");
assert(isMongoTransientError({ message: "WriteConflict" }), "WriteConflict message");
assert(!isMongoTransientError({ message: "예측이 아직 시작되지 않았습니다." }), "expected 400 is not transient");
assert(WS_MANAGER_CLIENT_HEARTBEAT_INTERVAL_MS === 15_000, "manager ping 15s");

console.log("OK: prediction HUD colors, cinematic plate, wait lefty, mongo retry");
