/**
 * 3아웃 가드·8초 중지 단일 루틴·유니폼 매핑
 * 실행: npx tsx scripts/test-ops-live-guards.ts
 */
import { readFileSync } from "fs";
import { deriveOperatorNextAction } from "../shared/operatorNextAction";
import { shouldExecutePredictionAutoStop } from "../shared/predictionAutoStop";
import {
  resolveShowThreeOutsHint,
  shouldSuggestSwitchHalf,
  shouldHoldSwitchHalfForLive,
  switchHalfHoldMessage,
  switchHalfLiveMovedOnMessage,
  liveHalfAlreadyStarted,
  liveOutsFromScoreboard,
  nullableInningHalf,
} from "../shared/threeOutsGuard";
import { AD_PLAY_MS, AD_PLAY_SECONDS, PREDICTION_AUTO_STOP_MS } from "../shared/adBreakTiming";
import { GAME_AWAY_TEAM_COLOR, GAME_HOME_TEAM_COLOR, GAME_OUTS_COLOR } from "../client/src/components/game/gameHudColors";
import { PYAMONG_ARMS_WAIT_WIDTH, PYAMONG_BATTER_BACK_WIDTH } from "../client/src/components/game/gameLayoutSizes";
import { AD_EARLY_DISMISS_SECONDS } from "../shared/predictionOdds";

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
assert(resolveShowThreeOutsHint({ liveOuts: 2, outsInHalf: 3 }) === true, "operator 3 outs wins over live 2");
assert(resolveShowThreeOutsHint({ liveOuts: 3, outsInHalf: 2 }) === false, "live 3 does not override operator 2");
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
  }) === false,
  "1-out next half does not tell operator to switch",
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
assert(shouldSuggestSwitchHalf({ outsInHalf: 3, liveOuts: 2 }) === false, "op 3 live 2 does not pulse switch");
assert(shouldSuggestSwitchHalf({ outsInHalf: 3, liveOuts: null }) === true, "no live outs → switch ok");
assert(shouldSuggestSwitchHalf({ outsInHalf: 3, liveOuts: 3 }) === true, "live 3 suggests switch");
assert(shouldSuggestSwitchHalf({ liveOuts: 2 }) === false, "2 outs never switch");
assert(shouldSuggestSwitchHalf({ liveOuts: 3, liveHalf: "top", operatorHalf: "top" }) === true, "live 3 same half");
assert(shouldSuggestSwitchHalf({ liveOuts: 3, liveHalf: "top", operatorHalf: "bottom" }) === false, "stale live 3 other half");
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
    showThreeOutsHint: true,
    holdSwitchForLive: true,
    liveOuts: 2,
  }).kind === "wait_live_three_outs",
  "live 2 holds next-action on switch",
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

console.log("OK: operator 3-out count, live hold for switch-half, single 8s stop, uniforms, ad 80s, back size");
