/**
 * 예측 HUD: 원정 청 / 홈 백, 시네마틱 플레이트, 포수 시점 타석
 * 실행: npx tsx scripts/test-prediction-hud-fix.ts
 */
import { GAME_AWAY_TEAM_COLOR, GAME_HOME_TEAM_COLOR, GAME_OUTS_COLOR } from "../client/src/components/game/gameHudColors";
import {
  cinematicHudAnchor,
  resolveGameSceneKind,
  shouldMirrorCinematic,
} from "../client/src/components/game/gameSceneBackground";
import {
  batterBoxImageForHand,
  BATTER_BOX_LEFT_IMAGE,
  BATTER_BOX_RIGHT_IMAGE,
  CINEMATIC_SCENE_IMAGE,
  HOME_PLATE_IMAGE,
  maybeMirrorImagePointX,
  PITCH_AWAY_PLATE_IMAGE,
  PITCH_HOME_PLATE_IMAGE,
  RUNNING_BASE_IMAGE_POINTS,
  STADIUM_IMAGE,
  stadiumImagePointToPx,
  WAIT_LEFT_HANDED_BOX_IMAGE,
} from "../client/src/components/game/stadiumFieldCoords";
import { isMongoTransientError } from "../shared/mongoTransientError";
import { WS_MANAGER_CLIENT_HEARTBEAT_INTERVAL_MS } from "../shared/wsHeartbeat";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(GAME_AWAY_TEAM_COLOR === "#1A6DFF", "away score blue");
assert(GAME_HOME_TEAM_COLOR === "#FFFFFF", "home score white");
assert(GAME_OUTS_COLOR === "#E11936", "outs crimson");
assert(!/#E11936/i.test(GAME_AWAY_TEAM_COLOR), "away is not red");

assert(CINEMATIC_SCENE_IMAGE.width === 1280, "pitch photos 1280");
assert(CINEMATIC_SCENE_IMAGE.height === 720, "pitch photos 720");
assert(PITCH_HOME_PLATE_IMAGE.y > 0.8, "pitch home plate in foreground");
assert(PITCH_AWAY_PLATE_IMAGE.y > 0.8, "pitch away plate in foreground");
assert(PITCH_HOME_PLATE_IMAGE.x > 0.4 && PITCH_HOME_PLATE_IMAGE.x < 0.6, "pitch home plate near center");

assert(batterBoxImageForHand("right").x < HOME_PLATE_IMAGE.x, "righty box is catcher-left");
assert(batterBoxImageForHand("left").x > HOME_PLATE_IMAGE.x, "lefty box is catcher-right");
assert(batterBoxImageForHand(null).x === BATTER_BOX_RIGHT_IMAGE.x, "unknown hand defaults righty");
assert(batterBoxImageForHand("left").x === BATTER_BOX_LEFT_IMAGE.x, "lefty uses left-hand box");
assert(WAIT_LEFT_HANDED_BOX_IMAGE.x > HOME_PLATE_IMAGE.x, "wait lefty is catcher-right");
assert(WAIT_LEFT_HANDED_BOX_IMAGE.x === BATTER_BOX_LEFT_IMAGE.x, "wait lefty uses 1st-base box");

assert(RUNNING_BASE_IMAGE_POINTS.아웃.x > 0.45 && RUNNING_BASE_IMAGE_POINTS.아웃.x < 0.55, "running home centered");
assert(RUNNING_BASE_IMAGE_POINTS["1루"].x > RUNNING_BASE_IMAGE_POINTS.아웃.x, "1st right of home");
assert(RUNNING_BASE_IMAGE_POINTS["3루"].x < RUNNING_BASE_IMAGE_POINTS.아웃.x, "3rd left of home");

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
  }) === "wait_home",
  "home lefty wait keeps wait_home (mirrored)",
);
assert(
  resolveGameSceneKind({
    gameDayPhase: "live",
    screenPhase: "wait_start",
    inningHalf: "top",
    batsSide: "left",
  }) === "wait_away",
  "away lefty wait keeps wait_away photo",
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

assert(shouldMirrorCinematic("pitch_home", "left") === true, "lefty mirrors pitch_home");
assert(shouldMirrorCinematic("pitch_away", "left") === true, "lefty mirrors pitch_away");
assert(shouldMirrorCinematic("pitch_home", "right") === false, "righty does not mirror pitch_home");
assert(shouldMirrorCinematic("pitch_away", null) === false, "unknown hand does not mirror pitch");
assert(shouldMirrorCinematic("wait_home", "left") === true, "lefty mirrors wait_home");
assert(shouldMirrorCinematic("wait_home", "right") === false, "righty does not mirror wait_home");
assert(shouldMirrorCinematic("wait_away", "left") === false, "lefty keeps wait_away (already right)");
assert(shouldMirrorCinematic("wait_away", "right") === true, "righty mirrors wait_away onto catcher-left");
assert(shouldMirrorCinematic("wait_away", null) === true, "unknown away wait defaults righty mirror");
assert(shouldMirrorCinematic("field", "left") === false, "field never mirrors");

assert(cinematicHudAnchor("wait_away").left === "66%", "away wait bubble on photo-right");
assert(cinematicHudAnchor("wait_away", true).left === "34%", "mirrored away wait bubble on catcher-left");
assert(cinematicHudAnchor("wait_home").left === "46%", "home wait bubble on photo-left");
assert(cinematicHudAnchor("wait_home", true).left === "54%", "mirrored home wait bubble on catcher-right");
assert(cinematicHudAnchor("pitch_home", true).left === "64%", "mirrored pitch_home bubble on catcher-right");

const mirroredAwayPlate = maybeMirrorImagePointX(PITCH_AWAY_PLATE_IMAGE, true);
assert(
  Math.abs(mirroredAwayPlate.x - (1 - PITCH_AWAY_PLATE_IMAGE.x)) < 1e-9,
  "mirrored away plate X",
);
assert(maybeMirrorImagePointX(PITCH_HOME_PLATE_IMAGE, true).x === 0.5, "home plate stays centered");
assert(maybeMirrorImagePointX(PITCH_HOME_PLATE_IMAGE, false).x === PITCH_HOME_PLATE_IMAGE.x, "no-op plate");

assert(isMongoTransientError({ code: 112 }), "WriteConflict 112");
assert(isMongoTransientError({ errorLabels: ["TransientTransactionError"] }), "transient label");
assert(isMongoTransientError({ message: "WriteConflict" }), "WriteConflict message");
assert(!isMongoTransientError({ message: "예측이 아직 시작되지 않았습니다." }), "expected 400 is not transient");
assert(WS_MANAGER_CLIENT_HEARTBEAT_INTERVAL_MS === 15_000, "manager ping 15s");

console.log("OK: prediction HUD colors, cinematic plate, catcher-view batter sides, mongo retry");
