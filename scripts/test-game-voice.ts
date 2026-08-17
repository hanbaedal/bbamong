/**
 * npx tsx scripts/test-game-voice.ts
 */
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  GAME_VOICE_CLIPS,
  GAME_VOICE_TEXT,
  type GameVoiceKey,
} from "../client/src/lib/gameVoiceAnnouncements";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const keys = Object.keys(GAME_VOICE_TEXT) as GameVoiceKey[];
assert(keys.length === Object.keys(GAME_VOICE_CLIPS).length, "text/clip key parity");

for (const key of keys) {
  const src = GAME_VOICE_CLIPS[key];
  assert(Boolean(GAME_VOICE_TEXT[key]?.trim()), `${key} text`);
  const path = resolve("client/public" + src);
  const size = statSync(path).size;
  assert(size > 200, `${src} too small (${size})`);
  const head = readFileSync(path).subarray(0, 3).toString("latin1");
  assert(head === "ID3" || head.charCodeAt(0) === 0xff, `${src} is not mp3`);
}

console.log(`game-voice clips OK (${keys.length} files)`);
