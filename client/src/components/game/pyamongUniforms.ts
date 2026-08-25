import pyamongBatterReadyHome from "@assets/game/pyamong-batter-ready-home.png";
import pyamongBatterReadyAway from "@assets/game/pyamong-batter-ready-away.png";
import pyamongWaitingHome from "@assets/game/pyamong-waiting.png";
import pyamongWaitingAway from "@assets/game/pyamong-waiting-away.png";
import pyamongRunningHome1 from "@assets/game/pyamong-running-1.png";
import pyamongRunningHome2 from "@assets/game/pyamong-running-2.png";
import pyamongRunningHome3 from "@assets/game/pyamong-running-3.png";
import pyamongRunningAway1 from "@assets/game/pyamong-running-away-1.png";
import pyamongRunningAway2 from "@assets/game/pyamong-running-away-2.png";
import pyamongRunningAway3 from "@assets/game/pyamong-running-away-3.png";
import type { InningHalf } from "@shared/gamePhaseTypes";

/** 초=원정(청색) 공격, 말=홈(흰색) 공격 */
export function isAwayBatting(half?: InningHalf | null): boolean {
  return half === "top";
}

const HOME_RUN_FRAMES = [
  pyamongRunningHome1,
  pyamongRunningHome2,
  pyamongRunningHome3,
  pyamongRunningHome2,
] as const;

const AWAY_RUN_FRAMES = [
  pyamongRunningAway1,
  pyamongRunningAway2,
  pyamongRunningAway3,
  pyamongRunningAway2,
] as const;

export function pyamongWaitingSrc(half?: InningHalf | null): string {
  return isAwayBatting(half) ? pyamongWaitingAway : pyamongWaitingHome;
}

export function pyamongBatterReadySrc(half?: InningHalf | null): string {
  return isAwayBatting(half) ? pyamongBatterReadyAway : pyamongBatterReadyHome;
}

export function pyamongRunFrames(half?: InningHalf | null): readonly string[] {
  return isAwayBatting(half) ? AWAY_RUN_FRAMES : HOME_RUN_FRAMES;
}
