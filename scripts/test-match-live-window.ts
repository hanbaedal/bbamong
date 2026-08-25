/**
 * 경기 시작 5분 전 운영자·사용자 활성화 창
 * 실행: npx tsx scripts/test-match-live-window.ts
 */
import { MATCH_LIVE_WINDOW_BEFORE_MS, isMatchLiveWindowOpen } from "../shared/matchLiveWindow";
import { CLIENT_POLL_START_BEFORE_MS, shouldClientPollMatch } from "../client/src/lib/matchPollWindow";
import { LIVE_SCORE_SYNC_START_BEFORE_MS } from "../server/apiSports/constants";
import { carryForwardAtBatResult } from "../server/apiSports/liveScoreboardPolicy";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(MATCH_LIVE_WINDOW_BEFORE_MS === 5 * 60_000, "shared window is 5 minutes");
assert(CLIENT_POLL_START_BEFORE_MS === MATCH_LIVE_WINDOW_BEFORE_MS, "client poll matches shared");
assert(LIVE_SCORE_SYNC_START_BEFORE_MS === MATCH_LIVE_WINDOW_BEFORE_MS, "server live sync default 5m");

const start = new Date(Date.now() + 4 * 60_000);
assert(shouldClientPollMatch(start, "scheduled") === true, "4 min before start is joinable");
assert(isMatchLiveWindowOpen(start) === true, "4 min before start is operator-live");
const later = new Date(Date.now() + 6 * 60_000);
assert(shouldClientPollMatch(later, "scheduled") === false, "6 min before start is not joinable");
assert(isMatchLiveWindowOpen(later) === false, "6 min before start is not operator-live");

const prev = {
  balls: 0,
  strikes: 0,
  outs: 1,
  first: false,
  second: false,
  third: false,
  batterName: "김타자",
  atBatResultDisplay: "삼진아웃" as const,
  suggestedResult: "아웃" as const,
};
const nextEmpty = {
  balls: 0,
  strikes: 0,
  outs: 1,
  first: false,
  second: false,
  third: false,
  batterName: "이타자",
  atBatResultDisplay: null,
  suggestedResult: null,
};
const carried = carryForwardAtBatResult(nextEmpty, prev);
assert(carried?.atBatResultDisplay === "삼진아웃", "carry result across batter change");

const nextPitches = { ...nextEmpty, balls: 1, atBatResultDisplay: null };
const cleared = carryForwardAtBatResult(nextPitches, prev);
assert(cleared?.atBatResultDisplay == null, "clear carried result once next at-bat has pitches");

console.log("OK: match live window 5m + carry-forward at-bat result");
