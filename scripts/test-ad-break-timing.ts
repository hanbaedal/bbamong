/**
 * 광고 80초 만료·워치독 — 운영자 타이머가 늘어나지 않게
 * 실행: npx tsx scripts/test-ad-break-timing.ts
 */
import {
  AD_PLAY_MS,
  AD_PLAY_SECONDS,
  AD_BREAK_TOTAL_MS,
  AD_INTRO_DELAY_MS,
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

assert(AD_PLAY_MS === 80_000, "ad play is 80 seconds");
assert(AD_PLAY_SECONDS === 80, "ad play seconds is 80");
assert(AD_BREAK_TOTAL_MS === AD_INTRO_DELAY_MS + AD_PLAY_MS, "break = intro + play");
assert(!isAdPlayExpired(now), "fresh start is not expired");
assert(isAdPlayExpired(now - AD_PLAY_MS), "exactly 80 seconds is expired");
assert(isAdPlayExpired(now - 5 * 60_000), "5 minutes is expired");
assert(adRemainingMs(now - 10_000, now) === 70_000, "remaining after 10s is 70s");

const live = resolveAdPlayingFromServer(true, now - 5_000, now);
assert(live.playing, "5s elapsed still playing");
assert(live.elapsedSec >= 4 && live.elapsedSec <= 6, `elapsed ${live.elapsedSec}`);

const stillAt79 = resolveAdPlayingFromServer(true, now - 79_000, now);
assert(stillAt79.playing, "79s elapsed still playing");

const stuck = resolveAdPlayingFromServer(true, now - 5 * 60_000, now);
assert(!stuck.playing, "5-minute leftover snapshot must not display as playing");
assert(stuck.elapsedSec === 0, "expired snapshot elapsed is 0");

wsManager.setAdPlaying(MATCH, false);
wsManager.backdateAdStartedAtForTest(MATCH, now - AD_PLAY_MS - 1_000);
assert(wsManager.isAdPlaying(MATCH), "backdated session still flagged on server");
broadcastManager.enforceAdDeadlines(MATCH);
assert(!wsManager.isAdPlaying(MATCH), "watchdog must stop expired ads");

broadcastManager.stopAdPlaying(MATCH, "operator_stop", "already idle");
assert(!wsManager.isAdPlaying(MATCH), "idle stop stays idle");

wsManager.setAdPlaying(MATCH, true);
const firstStart = wsManager.getMatchState(MATCH).adStartedAt;
wsManager.setAdPlaying(MATCH, true);
assert(
  wsManager.getMatchState(MATCH).adStartedAt === firstStart,
  "second setAdPlaying(true) must not reset the ad clock",
);
wsManager.setAdPlaying(MATCH, false);

console.log("OK: ad break timing 80s + watchdog");
process.exit(0);
