/**
 * 예측 화면 유지 vs 경기 고르기 모달
 * 실행: npx tsx scripts/test-remain-in-game-match.ts
 */
import {
  canRemainInGameMatch,
  isMatchSelectableForGame,
  type GameMatchItem,
} from "../client/src/components/game/gameMatchUtils";
import { shouldSuppressEmptyMatchOverlay } from "../client/src/lib/gameDayPhase";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const liveOn: GameMatchItem = {
  id: "m1",
  name: "1경기",
  stadiumName: "잠실",
  stadiumId: 1,
  startTime: new Date().toISOString(),
  matchStatus: "ongoing",
  sideBetEnabled: true,
};

const liveOff: GameMatchItem = { ...liveOn, sideBetEnabled: false };
const finished: GameMatchItem = { ...liveOn, matchStatus: "completed" };
const cancelled: GameMatchItem = { ...liveOn, matchStatus: "cancelled" };
const scheduledOn: GameMatchItem = { ...liveOn, matchStatus: "scheduled" };

assert(isMatchSelectableForGame(liveOn) === true, "live ON ongoing is selectable");
assert(canRemainInGameMatch(liveOn) === true, "live ON ongoing can remain");

assert(isMatchSelectableForGame(liveOff) === false, "live OFF is not selectable");
assert(canRemainInGameMatch(liveOff) === true, "live OFF ongoing still remains in game");

assert(canRemainInGameMatch(finished) === false, "completed cannot remain");
assert(isMatchSelectableForGame(finished) === false, "completed not selectable");

assert(canRemainInGameMatch(cancelled) === false, "cancelled cannot remain");
assert(isMatchSelectableForGame(scheduledOn) === true, "scheduled + live ON selectable");
assert(canRemainInGameMatch(scheduledOn) === true, "scheduled can remain");

assert(
  shouldSuppressEmptyMatchOverlay({ matchCount: 0, selectedMatchId: "m1" }) === true,
  "empty list with selected match does not become no_match overlay",
);
assert(
  shouldSuppressEmptyMatchOverlay({ matchCount: 0, selectedMatchId: null, matchesError: true }) ===
    true,
  "empty list on error does not become no_match overlay",
);
assert(
  shouldSuppressEmptyMatchOverlay({ matchCount: 0, selectedMatchId: null }) === false,
  "true empty day can still show no_match",
);
assert(
  shouldSuppressEmptyMatchOverlay({ matchCount: 2, selectedMatchId: "m1" }) === false,
  "non-empty list uses normal overlay",
);

console.log("OK: remain-in-game ignores live-sync OFF, still drops finished/cancelled");
