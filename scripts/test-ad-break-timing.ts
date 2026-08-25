/**
 * 광고 1분 만료·워치독 — 운영자 타이머가 5분으로 늘어나지 않게
 * 실행: npx tsx scripts/test-ad-break-timing.ts
 */
import {
  AD_PLAY_MS,
  isAdPlayExpired,
  resolveAdPlayingFromServer,
  adRemainingMs,
} from "../shared/adBreakTiming";
import { broadcastManager } from "../server/liveMatch/broadcastManager";
import { wsManager } from "../server/liveMatch/wsManager";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const MATCH = "ad-break-timing-test";
const now = Date.now();

assert(!isAdPlayExpired(now), "fresh start is not expired");
assert(isAdPlayExpired(now - AD_PLAY_MS), "exactly 1 minute is expired");
assert(isAdPlayExpired(now - 5 * 60_000), "5 minutes is expired");
assert(adRemainingMs(now - 10_000) <= 50_000, "remaining shrinks");

const live = resolveAdPlayingFromServer(true, now - 5_000, now);
assert(live.playing, "5s elapsed still playing");
assert(live.elapsedSec >= 4 && live.elapsedSec <= 6, `elapsed ${live.elapsedSec}`);

const stuck = resolveAdPlayingFromServer(true, now - 5 * 60_000, now);
assert(!stuck.playing, "5-minute leftover snapshot must not display as playing");
assert(stuck.elapsedSec === 0, "expired snapshot elapsed is 0");

wsManager.setAdPlaying(MATCH, false);
wsManager.backdateAdStartedAtForTest(MATCH, now - AD_PLAY_MS - 1_000);
assert(wsManager.isAdPlaying(MATCH), "backdated session still flagged on server");
broadcastManager.enforceAdDeadlines(MATCH);
assert(!wsManager.isAdPlaying(MATCH), "watchdog must stop expired ads");

wsManager.setAdPlaying(MATCH, true);
const firstStart = wsManager.getMatchState(MATCH).adStartedAt;
wsManager.setAdPlaying(MATCH, true);
assert(
  wsManager.getMatchState(MATCH).adStartedAt === firstStart,
  "second setAdPlaying(true) must not reset the 1-minute clock",
);
wsManager.setAdPlaying(MATCH, false);

console.log("OK: ad break timing + watchdog");
process.exit(0);
