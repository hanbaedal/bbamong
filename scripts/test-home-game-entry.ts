/**
 * npx tsx scripts/test-home-game-entry.ts
 */
import {
  HOME_DELAY_PREDICTION_LABEL,
  HOME_DELAY_PREDICTION_SOON,
  HOME_FRIEND_ROOM_LABEL,
  HOME_LIVE_PREDICTION_LABEL,
  resolveHomeLivePredictionLabel,
} from "../shared/homeGameEntry";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(HOME_LIVE_PREDICTION_LABEL === "실시간 예측게임", "live label");
assert(HOME_DELAY_PREDICTION_LABEL === "딜레이 예측게임", "delay label");
assert(HOME_FRIEND_ROOM_LABEL === "친구·동호회 방", "room label");
assert(HOME_DELAY_PREDICTION_SOON.includes("준비 중"), "delay soon");
assert(resolveHomeLivePredictionLabel(null) === HOME_LIVE_PREDICTION_LABEL, "null");
assert(resolveHomeLivePredictionLabel("") === HOME_LIVE_PREDICTION_LABEL, "empty");
assert(resolveHomeLivePredictionLabel("예측게임 하러가기") === HOME_LIVE_PREDICTION_LABEL, "legacy");
assert(resolveHomeLivePredictionLabel("경기 참여하기") === HOME_LIVE_PREDICTION_LABEL, "legacy 2");
assert(resolveHomeLivePredictionLabel("실시간 예측게임") === HOME_LIVE_PREDICTION_LABEL, "current");
assert(resolveHomeLivePredictionLabel("커스텀") === "커스텀", "custom stays");

console.log("home game entry OK");
