/**
 * npx tsx scripts/test-game-voice-session.ts
 */
import { consumeFirstPredictionOpen, consumeLiveMatchVoice } from "../client/src/lib/gameVoiceSession";

const store = new Map<string, string>();
(globalThis as { sessionStorage: Storage }).sessionStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    store.set(k, v);
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
};

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(consumeFirstPredictionOpen("m1") === true, "first open m1");
assert(consumeFirstPredictionOpen("m1") === false, "second open m1");
assert(consumeFirstPredictionOpen("m2") === true, "first open m2");
assert(consumeLiveMatchVoice("m1") === true, "live m1");
assert(consumeLiveMatchVoice("m1") === false, "live m1 again");

console.log("game-voice session OK");
