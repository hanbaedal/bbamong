/**
 * 딜레이 봇 전이 — 실시간 AD_PLAY_MS / 예측 훅을 수정하지 않았는지 함께 확인.
 * 실행: npx tsx scripts/test-delay-game.ts
 */
import {
  DELAY_AD_BREAK_MS,
  DELAY_AD_INTRO_MS,
  DELAY_AD_PLAY_MS,
  DELAY_AD_PLAY_SECONDS,
  DELAY_BATTER_STABLE_MS,
  DELAY_GAME_PATH,
  DELAY_LIVE_BLOCK_MESSAGE,
  DELAY_PREDICTION_OPEN_MS,
  DELAY_RESULT_STABLE_MS,
  DELAY_SCHEDULER_MATCH_STATUSES,
  delayBatterKey,
  delayHalfChanged,
  delayPitcherChanged,
  delayUiStage,
  isDelayMatchEnded,
  isDelayMatchOngoing,
} from "../shared/delayGame";
import { AD_PLAY_MS, AD_PLAY_SECONDS } from "../shared/adBreakTiming";
import {
  emptyDelayState,
  nextDelayPhase,
  snapshotLive,
} from "../server/delayGame/engine";
import type { LiveScoreboard } from "../shared/apiSportsTypes";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function live(partial: {
  inning?: number;
  half?: "top" | "bottom";
  outs?: number;
  batterName?: string;
  pitcherName?: string;
  suggested?: "아웃" | "1루" | "2루" | "3루" | "홈런" | null;
}): ReturnType<typeof snapshotLive> {
  const board: LiveScoreboard = {
    homeTeamName: "홈",
    awayTeamName: "원정",
    homeScore: 0,
    awayScore: 0,
    homeHits: 0,
    awayHits: 0,
    homeErrors: 0,
    awayErrors: 0,
    inning: partial.inning ?? 1,
    inningHalf: partial.half ?? "top",
    inningLabel: "1회초",
    statusShort: "LIVE",
    statusLong: "In Progress",
    syncedAt: new Date().toISOString(),
    situation: {
      balls: 0,
      strikes: 0,
      outs: partial.outs ?? 0,
      first: false,
      second: false,
      third: false,
      batterName: partial.batterName ?? "",
      pitcherName: partial.pitcherName ?? "",
      suggestedResult: partial.suggested ?? null,
    },
  };
  return snapshotLive(board);
}

function tick(
  input: Parameters<typeof nextDelayPhase>[0] & { matchOngoing?: boolean },
) {
  return nextDelayPhase({
    ...input,
    matchOngoing: input.matchOngoing ?? true,
  });
}

assert(DELAY_GAME_PATH === "/delay-prediction", "delay path");
assert(DELAY_AD_PLAY_MS === 40_000, "delay ad 40s");
assert(DELAY_AD_PLAY_SECONDS === 40, "delay ad seconds 40");
assert(DELAY_AD_INTRO_MS === 5_000, "delay intro 5s");
assert(DELAY_AD_BREAK_MS === 45_000, "delay break 45s");
assert(DELAY_PREDICTION_OPEN_MS === 8_000, "open 8s");
assert(DELAY_BATTER_STABLE_MS === 2_000, "batter stable 2s");
assert(DELAY_RESULT_STABLE_MS === 12_000, "result stable 12s");
assert(AD_PLAY_MS === 80_000, "live ad still 80s");
assert(AD_PLAY_SECONDS === 80, "live ad seconds still 80");
assert(DELAY_LIVE_BLOCK_MESSAGE.includes("실시간"), "live block copy");
assert(delayUiStage("open") === "open", "ui open");
assert(delayUiStage("closed") === "closed", "ui closed");
assert(delayUiStage("idle") === "wait", "ui idle");
assert(delayBatterKey({ inning: 3, half: "bottom", batterName: "김타자" }) === "3:bottom:김타자");
assert(
  delayHalfChanged({ prevInning: 1, prevHalf: "top", nextInning: 1, nextHalf: "bottom" }),
  "half change",
);
assert(
  !delayHalfChanged({ prevInning: 1, prevHalf: "top", nextInning: 1, nextHalf: "top" }),
  "same half",
);
assert(delayPitcherChanged("박투수", "이투수"), "pitcher change");
assert(!delayPitcherChanged("박투수", "박투수"), "same pitcher");
assert(!delayPitcherChanged("", "이투수"), "empty prev pitcher ignored");

const t0 = 1_000_000;
const seed = tick({
  state: emptyDelayState(),
  now: t0,
  live: live({ batterName: "김타자", pitcherName: "박투수" }),
  matchEnded: false,
});
assert(seed.patch.seeded === true, "first tick seeds");
assert(seed.patch.phase == null, "seed does not open yet");
assert(!seed.settleRound, "seed no settle");

const idleWait = tick({
  state: emptyDelayState({
    seeded: true,
    pendingBatterName: "김타자",
    pendingBatterSince: t0,
    lastPitcherName: "박투수",
    lastHalf: "top",
    lastInning: 1,
  }),
  now: t0 + DELAY_BATTER_STABLE_MS - 1,
  live: live({ batterName: "김타자", pitcherName: "박투수" }),
  matchEnded: false,
});
assert(idleWait.patch.phase == null, "batter not stable yet");

const idleOpen = tick({
  state: emptyDelayState({
    seeded: true,
    pendingBatterName: "김타자",
    pendingBatterSince: t0,
    lastPitcherName: "박투수",
    lastHalf: "top",
    lastInning: 1,
  }),
  now: t0 + DELAY_BATTER_STABLE_MS,
  live: live({ batterName: "김타자", pitcherName: "박투수" }),
  matchEnded: false,
});
assert(idleOpen.patch.phase === "open", "stable new batter opens");
assert(idleOpen.patch.roundNumber === 1, "round increments");
assert(idleOpen.patch.openAtMs === t0 + DELAY_BATTER_STABLE_MS, "openAt");

const openHold = tick({
  state: emptyDelayState({
    seeded: true,
    phase: "open",
    roundNumber: 1,
    batterName: "김타자",
    batterKey: "1:top:김타자",
    openAtMs: t0,
    pendingResult: "아웃",
    pendingResultSince: t0 + 1_000,
  }),
  now: t0 + 3_000,
  live: live({ batterName: "김타자", suggested: "아웃" }),
  matchEnded: false,
});
assert(openHold.patch.phase == null, "open stays until 8s");
assert(openHold.patch.pendingResultSince == null, "same suggested does not reset clock");

const openClose = tick({
  state: emptyDelayState({
    seeded: true,
    phase: "open",
    roundNumber: 1,
    batterName: "김타자",
    openAtMs: t0,
    pendingResult: "1루",
    pendingResultSince: t0 + 2_000,
  }),
  now: t0 + DELAY_PREDICTION_OPEN_MS,
  live: live({ batterName: "김타자", suggested: "1루" }),
  matchEnded: false,
});
assert(openClose.patch.phase === "closed", "8s closes");
assert(openClose.patch.pendingResultSince !== t0 + DELAY_PREDICTION_OPEN_MS, "does not reset clock at close");

const closedWait = tick({
  state: emptyDelayState({
    seeded: true,
    phase: "closed",
    roundNumber: 1,
    batterName: "김타자",
    lastHalf: "top",
    lastInning: 1,
    lastPitcherName: "박투수",
    pendingResult: "1루",
    pendingResultSince: t0,
  }),
  now: t0 + DELAY_RESULT_STABLE_MS - 1,
  live: live({ batterName: "김타자", pitcherName: "박투수", suggested: "1루" }),
  matchEnded: false,
});
assert(!closedWait.settleRound, "not stable yet");
assert(closedWait.patch.phase == null, "stays closed");

const closedSettle = tick({
  state: emptyDelayState({
    seeded: true,
    phase: "closed",
    roundNumber: 1,
    batterName: "김타자",
    lastHalf: "top",
    lastInning: 1,
    lastPitcherName: "박투수",
    pendingResult: "1루",
    pendingResultSince: t0,
  }),
  now: t0 + DELAY_RESULT_STABLE_MS,
  live: live({ batterName: "김타자", pitcherName: "박투수", suggested: "1루" }),
  matchEnded: false,
});
assert(closedSettle.settleRound, "stable result settles");
assert(closedSettle.settleResult === "1루", "settle 1루");
assert(closedSettle.patch.phase === "idle", "same half/pitcher -> idle");

const closedHalfAd = tick({
  state: emptyDelayState({
    seeded: true,
    phase: "closed",
    roundNumber: 1,
    batterName: "김타자",
    lastHalf: "top",
    lastInning: 1,
    lastPitcherName: "박투수",
    pendingResult: "아웃",
    pendingResultSince: t0,
  }),
  now: t0 + DELAY_RESULT_STABLE_MS,
  live: live({
    inning: 1,
    half: "bottom",
    batterName: "박타자",
    pitcherName: "박투수",
    suggested: "아웃",
  }),
  matchEnded: false,
});
assert(closedHalfAd.patch.phase === "ad", "half change -> ad");
assert(closedHalfAd.patch.adReason === "switch_half", "switch_half reason");
assert(closedHalfAd.patch.adUntilMs === t0 + DELAY_RESULT_STABLE_MS + DELAY_AD_BREAK_MS, "45s ad");

const closedPitcherAd = tick({
  state: emptyDelayState({
    seeded: true,
    phase: "closed",
    roundNumber: 1,
    batterName: "김타자",
    lastHalf: "top",
    lastInning: 1,
    lastPitcherName: "박투수",
    pendingResult: "아웃",
    pendingResultSince: t0,
  }),
  now: t0 + DELAY_RESULT_STABLE_MS,
  live: live({
    batterName: "이타자",
    pitcherName: "최투수",
    suggested: "아웃",
  }),
  matchEnded: false,
});
assert(closedPitcherAd.patch.phase === "ad", "pitcher change -> ad");
assert(closedPitcherAd.patch.adReason === "pitcher_change", "pitcher reason");

const batterGoneRefund = tick({
  state: emptyDelayState({
    seeded: true,
    phase: "closed",
    roundNumber: 1,
    batterName: "김타자",
    lastHalf: "top",
    lastInning: 1,
    lastPitcherName: "박투수",
  }),
  now: t0 + 3_000,
  live: live({ batterName: "이타자", pitcherName: "박투수" }),
  matchEnded: false,
});
assert(batterGoneRefund.settleRound, "batter change settles");
assert(batterGoneRefund.settleResult === null, "no suggested -> refund");

const adHold = tick({
  state: emptyDelayState({
    seeded: true,
    phase: "ad",
    adUntilMs: t0 + DELAY_AD_BREAK_MS,
    adReason: "switch_half",
  }),
  now: t0 + 10_000,
  live: live({ batterName: "지나간타자" }),
  matchEnded: false,
});
assert(adHold.patch.phase == null, "ad holds");
assert(!adHold.settleRound, "ad skips at-bats");

const adDone = tick({
  state: emptyDelayState({
    seeded: true,
    phase: "ad",
    adUntilMs: t0 + DELAY_AD_BREAK_MS,
    adReason: "switch_half",
    lastHalf: "top",
    lastInning: 1,
  }),
  now: t0 + DELAY_AD_BREAK_MS,
  live: live({ inning: 1, half: "bottom", batterName: "새타자", pitcherName: "박투수" }),
  matchEnded: false,
});
assert(adDone.patch.phase === "idle", "ad ends to idle");

const matchEnd = tick({
  state: emptyDelayState({ seeded: true, phase: "open", roundNumber: 2 }),
  now: t0,
  live: live({}),
  matchEnded: true,
});
assert(matchEnd.patch.phase === "ended", "match end");
assert(matchEnd.settleRound, "open round refunded on end");
assert(matchEnd.settleResult === null, "end without result refunds");

assert(isDelayMatchOngoing("ongoing"), "ongoing is live");
assert(!isDelayMatchOngoing("scheduled"), "scheduled is not live");
assert(!isDelayMatchOngoing("completed"), "completed is not live");
assert(isDelayMatchEnded("completed"), "completed ended");
assert(isDelayMatchEnded("종료"), "korean ended");
assert(!isDelayMatchEnded("ongoing"), "ongoing not ended");
assert(DELAY_SCHEDULER_MATCH_STATUSES.join(",") === "ongoing", "scheduler ongoing only");

const scheduledHold = tick({
  state: emptyDelayState({
    seeded: true,
    pendingBatterName: "김타자",
    pendingBatterSince: t0 - 60_000,
    lastPitcherName: "박투수",
    lastHalf: "top",
    lastInning: 1,
  }),
  now: t0 + DELAY_BATTER_STABLE_MS,
  live: live({ batterName: "김타자", pitcherName: "박투수" }),
  matchEnded: false,
  matchOngoing: false,
});
assert(scheduledHold.patch.phase == null, "scheduled does not open");
assert(scheduledHold.patch.pendingBatterSince === null, "scheduled clears batter clock");
assert(!scheduledHold.settleRound, "scheduled no settle");

const scheduledSeed = tick({
  state: emptyDelayState(),
  now: t0,
  live: live({ batterName: "선발타자", pitcherName: "박투수" }),
  matchEnded: false,
  matchOngoing: false,
});
assert(scheduledSeed.patch.seeded === true, "scheduled still seeds last names");
assert(scheduledSeed.patch.pendingBatterSince === null, "scheduled seed has no batter clock");
assert(scheduledSeed.patch.phase == null, "scheduled seed does not open");

const scheduledOpenRefund = tick({
  state: emptyDelayState({
    seeded: true,
    phase: "open",
    roundNumber: 1,
    batterName: "김타자",
    openAtMs: t0,
  }),
  now: t0 + 3_000,
  live: live({ batterName: "김타자" }),
  matchEnded: false,
  matchOngoing: false,
});
assert(scheduledOpenRefund.patch.phase === "idle", "pre-live open returns idle");
assert(scheduledOpenRefund.settleRound, "pre-live open refunds");
assert(scheduledOpenRefund.settleResult === null, "pre-live open no result");

console.log("delay game engine OK");
