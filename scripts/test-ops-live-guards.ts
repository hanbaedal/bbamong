/**
 * 3아웃 가드·8초 중지 단일 루틴·유니폼 매핑
 * 실행: npx tsx scripts/test-ops-live-guards.ts
 */
import { readFileSync } from "fs";
import { computeInningHalfCatchUp } from "../server/liveMatch/gamePhase";
import { deriveOperatorNextAction } from "../shared/operatorNextAction";
import { shouldExecutePredictionAutoStop } from "../shared/predictionAutoStop";
import {
  resolveShowThreeOutsHint,
  shouldSuggestSwitchHalf,
  shouldHoldSwitchHalfForLive,
  shouldCatchUpSwitchHalf,
  switchHalfHoldMessage,
  switchHalfLiveMovedOnMessage,
  liveHalfAlreadyStarted,
  liveOutsFromScoreboard,
  nullableInningHalf,
  isLivePhaseBehindOperator,
  isStaleLiveThreeOutsAfterSwitch,
  switchHalfAdBreakMessage,
  liveThreeOutsSameHalf,
  canAdvanceInningHalf,
  shouldBlockAdvanceForSwitchHalf,
  shouldContinueSameHalfAfterResult,
} from "../shared/threeOutsGuard";
import { AD_PLAY_MS, AD_PLAY_SECONDS, PREDICTION_AUTO_STOP_MS } from "../shared/adBreakTiming";
import { GAME_AWAY_TEAM_COLOR, GAME_HOME_TEAM_COLOR, GAME_OUTS_COLOR } from "../client/src/components/game/gameHudColors";
import { PYAMONG_ARMS_WAIT_WIDTH, PYAMONG_BATTER_BACK_WIDTH } from "../client/src/components/game/gameLayoutSizes";
import { AD_EARLY_DISMISS_SECONDS } from "../shared/predictionOdds";
import {
  clientPhaseAfterPredictionClosed,
  hasClientPredictionStake,
  shouldKeepWaitResultWithoutCheck,
  shouldShowSettledResultFlash,
} from "../shared/predictionUiStage";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(GAME_AWAY_TEAM_COLOR === "#1A6DFF", "away blue");
assert(GAME_HOME_TEAM_COLOR === "#FFFFFF", "home white");
assert(GAME_OUTS_COLOR === "#E11936", "outs crimson");
const uniformSrc = readFileSync("client/src/components/game/pyamongUniforms.ts", "utf8");
assert(uniformSrc.includes('return half === "top"'), "top inning is away batting");
assert(uniformSrc.includes("pyamongWaitingAway"), "away wait sprite is blue jersey PNG");
assert(uniformSrc.includes("pyamongWaitingHome") || uniformSrc.includes("pyamong-waiting.png"), "home wait sprite is white jersey PNG");

assert(liveOutsFromScoreboard({ situation: { outs: 2 } }) === 2, "live outs 2");
assert(resolveShowThreeOutsHint({ liveOuts: 2, outsInHalf: 3 }) === false, "live 2 does not pulse 3-out voice");
assert(resolveShowThreeOutsHint({ liveOuts: 1, outsInHalf: 3 }) === false, "live 1 does not pulse 3-out voice");
assert(resolveShowThreeOutsHint({ liveOuts: 3, outsInHalf: 2 }) === true, "same-half live 3 opens switch even if operator has 2");
assert(resolveShowThreeOutsHint({ outsInHalf: 3 }) === true, "no live → DB 3 is hint");
assert(resolveShowThreeOutsHint({ outsInHalf: 2 }) === false, "operator 2 is not three outs");
assert(shouldHoldSwitchHalfForLive({ outsInHalf: 3, liveOuts: 2 }) === true, "op 3 live 2 holds switch");
assert(shouldHoldSwitchHalfForLive({ outsInHalf: 3, liveOuts: 0 }) === true, "op 3 live 0 holds switch");
assert(shouldHoldSwitchHalfForLive({ outsInHalf: 3, liveOuts: 3 }) === false, "live 3 allows switch");
assert(shouldHoldSwitchHalfForLive({ outsInHalf: 3, liveOuts: null }) === false, "missing live does not hold");
assert(
  liveHalfAlreadyStarted({
    outsInHalf: 3,
    liveOuts: 1,
    liveHalf: "bottom",
    operatorHalf: "top",
  }) === true,
  "live 1-out next half is moved-on",
);
assert(
  resolveShowThreeOutsHint({
    outsInHalf: 3,
    liveOuts: 1,
    liveHalf: "bottom",
    operatorHalf: "top",
  }) === false,
  "1-out next half hides 3-out hint",
);
assert(
  shouldSuggestSwitchHalf({
    outsInHalf: 3,
    liveOuts: 1,
    liveHalf: "bottom",
    operatorHalf: "top",
  }) === true,
  "1-out next half tells operator to catch-up switch",
);
assert(
  shouldCatchUpSwitchHalf({
    outsInHalf: 3,
    liveOuts: 1,
    liveHalf: "bottom",
    operatorHalf: "top",
  }) === true,
  "1-out next half is catch-up switch",
);
assert(
  canAdvanceInningHalf({
    outsInHalf: 3,
    liveOuts: 1,
    liveHalf: "bottom",
    operatorHalf: "top",
  }) === true,
  "live next half 0-2 allows catch-up switch",
);
assert(
  shouldBlockAdvanceForSwitchHalf({
    outsInHalf: 3,
    liveOuts: 1,
    liveHalf: "bottom",
    operatorHalf: "top",
  }) === true,
  "live next half blocks next batter — switch instead",
);
assert(
  shouldCatchUpSwitchHalf({
    outsInHalf: 3,
    liveOuts: 1,
    liveHalf: "bottom",
    operatorHalf: "top",
    recentlySwitched: true,
  }) === false,
  "just-switched does not catch-up again",
);
assert(
  shouldCatchUpSwitchHalf({
    outsInHalf: 0,
    liveOuts: 1,
    liveHalf: "top",
    operatorHalf: "top",
    liveInning: 6,
    operatorInning: 5,
  }) === true,
  "later inning same half name is catch-up",
);
assert(
  shouldHoldSwitchHalfForLive({
    outsInHalf: 3,
    liveOuts: 0,
    liveHalf: "bottom",
    operatorHalf: "top",
  }) === false,
  "next half 0-2 outs is catch-up, not live-hold",
);
assert(
  switchHalfLiveMovedOnMessage(1).includes("1아웃"),
  "moved-on message names live 1 out",
);
assert(
  switchHalfLiveMovedOnMessage(1).includes("공수교대"),
  "moved-on message tells operator to switch",
);
assert(
  !switchHalfLiveMovedOnMessage(1).includes("공수교대하지"),
  "moved-on message no longer forbids switch",
);
assert(shouldSuggestSwitchHalf({ outsInHalf: 3, liveOuts: 2 }) === false, "op 3 live 2 does not pulse switch");
assert(shouldSuggestSwitchHalf({ outsInHalf: 3, liveOuts: null }) === true, "no live outs → switch ok");
assert(shouldSuggestSwitchHalf({ outsInHalf: 3, liveOuts: 3 }) === true, "live 3 suggests switch");
assert(shouldSuggestSwitchHalf({ liveOuts: 2 }) === false, "2 outs never switch");
assert(
  liveThreeOutsSameHalf({ liveOuts: 3, liveHalf: "top", operatorHalf: "top" }) === true,
  "live 3 same half is mid-join switch signal",
);
assert(
  shouldSuggestSwitchHalf({ liveOuts: 3, liveHalf: "top", operatorHalf: "top" }) === true,
  "mid-join live 3 same half suggests switch",
);
assert(
  resolveShowThreeOutsHint({ outsInHalf: 0, liveOuts: 3, liveHalf: "top", operatorHalf: "top" }) === true,
  "mid-join live 3 shows 3-out hint",
);
assert(
  shouldSuggestSwitchHalf({
    outsInHalf: 0,
    liveOuts: 3,
    liveHalf: "top",
    operatorHalf: "top",
    recentlySwitched: true,
  }) === false,
  "just-switched 0 outs + live 3 does not suggest",
);
assert(
  canAdvanceInningHalf({ outsInHalf: 0, liveOuts: 3, liveHalf: "top", operatorHalf: "top" }) === true,
  "mid-join live 3 allows switch-half",
);
assert(
  canAdvanceInningHalf({
    outsInHalf: 0,
    liveOuts: 3,
    liveHalf: "top",
    operatorHalf: "top",
    recentlySwitched: true,
  }) === false,
  "just-switched live 3 does not allow another switch",
);
assert(
  shouldSuggestSwitchHalf({ outsInHalf: 3, liveOuts: 3, liveHalf: "top", operatorHalf: "top" }) === true,
  "operator 3 + live 3 same half suggests",
);
assert(shouldSuggestSwitchHalf({ liveOuts: 3, liveHalf: "top", operatorHalf: "bottom" }) === false, "stale live 3 other half");
assert(
  isStaleLiveThreeOutsAfterSwitch({ outsInHalf: 0, liveOuts: 3, liveHalf: "bottom", operatorHalf: "bottom" }) === true,
  "0 outs + live 3 is post-switch residue",
);
assert(
  isStaleLiveThreeOutsAfterSwitch({ outsInHalf: 3, liveOuts: 3, liveHalf: "top", operatorHalf: "top" }) === false,
  "operator 3 + live 3 is real three outs",
);
assert(
  isLivePhaseBehindOperator({
    liveHalf: "top",
    operatorHalf: "bottom",
    liveInning: 3,
    operatorInning: 3,
  }) === true,
  "same inning live top is behind operator bottom",
);
assert(
  isLivePhaseBehindOperator({
    liveHalf: "bottom",
    operatorHalf: "top",
    liveInning: 3,
    operatorInning: 4,
  }) === true,
  "previous bottom is behind next-inning top",
);
assert(
  isLivePhaseBehindOperator({
    liveHalf: "bottom",
    operatorHalf: "top",
    liveInning: 3,
    operatorInning: 3,
  }) === false,
  "same inning live bottom is ahead of operator top",
);
assert(
  computeInningHalfCatchUp(
    { gameInning: 5, inningHalf: "top", awayBatterOrder: 4, homeBatterOrder: 2 },
    { gameInning: 5, inningHalf: "bottom" },
  ).inningHalf === "bottom",
  "catch-up top→bottom keeps inning",
);
assert(
  computeInningHalfCatchUp(
    { gameInning: 5, inningHalf: "bottom", awayBatterOrder: 4, homeBatterOrder: 2 },
    { gameInning: 6, inningHalf: "top" },
  ).gameInning === 6,
  "catch-up uses live inning not operator+1 from a drifted gameInning",
);
assert(nullableInningHalf(undefined) == null, "missing half is null not top");
assert(switchHalfHoldMessage(2).includes("실황 2아웃"), "hold message names live outs");
assert(switchHalfHoldMessage(2).includes("한 번 더"), "hold message tells operator to press again");

assert(
  deriveOperatorNextAction({
    atBatPhase: "result_confirmed",
    showThreeOutsHint: false,
    needsAdvanceAfterResult: true,
  }).kind === "next_batter",
  "2-out result → next batter not switch",
);
assert(
  deriveOperatorNextAction({
    atBatPhase: "result_confirmed",
    showThreeOutsHint: true,
  }).kind === "switch_half",
  "3-out hint → switch",
);
assert(
  deriveOperatorNextAction({
    atBatPhase: "result_confirmed",
    showThreeOutsHint: false,
    catchUpSwitchHalf: true,
    liveOuts: 1,
  }).kind === "switch_half",
  "live already next half → switch catch-up",
);
assert(
  deriveOperatorNextAction({
    atBatPhase: "result_confirmed",
    showThreeOutsHint: false,
    holdSwitchForLive: true,
    liveOuts: 2,
  }).kind === "start_prediction",
  "op 3 live 2 after result → start same at-bat",
);
assert(
  deriveOperatorNextAction({
    atBatPhase: "idle",
    showThreeOutsHint: false,
    holdSwitchForLive: true,
    liveOuts: 2,
  }).kind === "wait_live_three_outs",
  "hold without result waits for live 3",
);
assert(
  deriveOperatorNextAction({ atBatPhase: "idle", gameSuspended: true }).kind === "none",
  "rain delay is not start_prediction",
);
assert(shouldBlockAdvanceForSwitchHalf({ outsInHalf: 3, liveOuts: 2 }) === false, "op 3 live 2 does not block start");
assert(shouldContinueSameHalfAfterResult({ outsInHalf: 3, liveOuts: 2, liveHalf: "top", operatorHalf: "top" }) === true, "same half live 2 continues at-bat");
assert(shouldContinueSameHalfAfterResult({ outsInHalf: 3, liveOuts: 3, liveHalf: "top", operatorHalf: "top" }) === false, "live 3 does not continue");
assert(shouldBlockAdvanceForSwitchHalf({ outsInHalf: 2, liveOuts: 2 }) === false, "2 outs does not block advance");
assert(
  shouldBlockAdvanceForSwitchHalf({
    outsInHalf: 0,
    liveOuts: 3,
    liveHalf: "top",
    operatorHalf: "top",
  }) === true,
  "mid-join live 3 blocks next batter",
);
assert(
  shouldBlockAdvanceForSwitchHalf({
    outsInHalf: 0,
    liveOuts: 3,
    liveHalf: "top",
    operatorHalf: "top",
    recentlySwitched: true,
  }) === false,
  "just-switched live 3 does not block advance",
);

assert(shouldExecutePredictionAutoStop({ predictionEnabled: true, phase: "prediction_open" }), "open stops");
assert(shouldExecutePredictionAutoStop({ predictionEnabled: true, phase: "idle" }), "enabled+idle desync still stops");
assert(!shouldExecutePredictionAutoStop({ predictionEnabled: true, phase: "prediction_closed" }), "already closed");
assert(!shouldExecutePredictionAutoStop({ predictionEnabled: false, phase: "prediction_open" }), "not enabled");
assert(PREDICTION_AUTO_STOP_MS === 8_000, "single 8s stop");

assert(AD_PLAY_MS === 80_000, "ad 80s");
assert(AD_PLAY_SECONDS === 80, "ad seconds 80");
assert(AD_EARLY_DISMISS_SECONDS === 5, "X after 5s");
assert(PYAMONG_BATTER_BACK_WIDTH === "min(12.6vw, 101px)", "back 70% of 18vw/144");
assert(PYAMONG_ARMS_WAIT_WIDTH === "min(18vw, 144px)", "arms wait unchanged");

assert(clientPhaseAfterPredictionClosed(true) === "wait_result", "predictor waits for result");
assert(clientPhaseAfterPredictionClosed(false) === "wait_result", "no pick also waits for result");
assert(hasClientPredictionStake({}) === false, "no stake");
assert(hasClientPredictionStake({ activeBet: { id: 1 } }) === true, "active bet is stake");
assert(hasClientPredictionStake({ submitting: true }) === true, "in-flight submit is stake");
assert(
  shouldKeepWaitResultWithoutCheck({
    hasLocalBet: true,
    submitting: true,
    awaitRound: 3,
    checkRound: 3,
  }) === true,
  "same-round predictor keeps wait_result",
);
assert(
  shouldKeepWaitResultWithoutCheck({
    hasLocalBet: false,
    submitting: true,
    awaitRound: 3,
    checkRound: 3,
  }) === true,
  "in-flight submit keeps wait_result",
);
assert(
  shouldKeepWaitResultWithoutCheck({
    hasLocalBet: false,
    submitting: false,
    awaitRound: 3,
    checkRound: 3,
  }) === true,
  "no-pick same round keeps wait_result for result flash",
);
assert(
  shouldKeepWaitResultWithoutCheck({
    hasLocalBet: false,
    submitting: false,
    awaitRound: 3,
    checkRound: 4,
  }) === false,
  "no-pick round change releases wait_result",
);
assert(
  shouldKeepWaitResultWithoutCheck({
    hasLocalBet: true,
    submitting: true,
    awaitRound: 3,
    checkRound: 4,
  }) === false,
  "round change releases wait_result",
);
assert(
  shouldKeepWaitResultWithoutCheck({
    hasLocalBet: false,
    submitting: false,
    awaitRound: 3,
    checkRound: 3,
    resultAlreadyShown: true,
  }) === false,
  "already-shown result releases wait_result",
);
assert(shouldShowSettledResultFlash({ alreadyAcked: false, presenting: false }) === true, "unset result flashes once");
assert(shouldShowSettledResultFlash({ alreadyAcked: true, presenting: false }) === false, "acked result does not replay");

console.log("OK: live-3-only 3-out voice, live hold, catch-up switch, no-pick same result flow, uniforms, ad 80s, back size");
