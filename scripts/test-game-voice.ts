/**
 * npx tsx scripts/test-game-voice.ts
 */
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  GAME_VOICE_CLIPS,
  OPERATOR_GAME_VOICE,
  USER_GAME_VOICE,
  resolveGameVoiceClip,
} from "../client/src/lib/gameVoiceAnnouncements";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(
  resolveGameVoiceClip(USER_GAME_VOICE.predictionStarted) ===
    "/audio/voice-prediction-started.mp3",
  "start clip",
);
assert(
  resolveGameVoiceClip(USER_GAME_VOICE.predictionStopped) ===
    "/audio/voice-prediction-stopped.mp3",
  "stop clip",
);
assert(
  resolveGameVoiceClip(OPERATOR_GAME_VOICE.threeOuts) === "/audio/voice-three-outs.mp3",
  "three-out clip",
);
assert(!resolveGameVoiceClip("없는 문장"), "unknown has no clip");

const files = [
  ...Object.values(GAME_VOICE_CLIPS),
  "/audio/silent.mp3",
  "/audio/intro-tagline.mp3",
];
for (const src of files) {
  const path = resolve("client/public" + src);
  const size = statSync(path).size;
  assert(size > 200, `${src} too small (${size})`);
  const head = readFileSync(path).subarray(0, 3).toString("latin1");
  assert(head === "ID3" || head.charCodeAt(0) === 0xff, `${src} is not mp3`);
}

console.log("game-voice clips OK");
