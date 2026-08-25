/**
 * KBO 연장 — 9회 동점 END를 경기종료로 오인하지 않는지
 * 실행: npx tsx scripts/test-kbo-extra-inning.ts
 */
import { parseDaumLiveScoreboard } from "../server/daumLive/parseDaumLiveScoreboard";
import type { DaumListGame } from "../server/daumLive/daumHermesClient";
import { resolveMatchStatusFromScoreboard } from "../server/apiSports/syncService";
import {
  shouldKeepPollingCompletedKboGame,
  shouldTreatKboScoreboardAsFinal,
} from "../shared/kboGameComplete";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function game(partial: Partial<DaumListGame> & { awayRun: number; homeRun: number; awayInn: string; homeInn: string }): DaumListGame {
  return {
    gameStatus: partial.gameStatus,
    periodType: partial.periodType,
    away: { team: { shortNameKo: "NC", nameKo: "NC" } },
    home: { team: { shortNameKo: "LG", nameKo: "LG" } },
    awayScore: { run: partial.awayRun, hit: 0, error: 0, ballfour: 0, inning: partial.awayInn },
    homeScore: { run: partial.homeRun, hit: 0, error: 0, ballfour: 0, inning: partial.homeInn },
  };
}

const extrasLive = parseDaumLiveScoreboard(
  game({
    gameStatus: "PLAY",
    periodType: "B10",
    awayRun: 4,
    homeRun: 3,
    awayInn: "0,1,1,0,0,0,0,0,1,1",
    homeInn: "0,0,0,0,0,0,0,3,0,0",
  }),
);
assert(extrasLive.inning === 10, `extras inning ${extrasLive.inning}`);
assert(extrasLive.inningHalf === "bottom", `extras half ${extrasLive.inningHalf}`);
assert(extrasLive.inningLabel === "10회 말", extrasLive.inningLabel);
assert(extrasLive.statusShort !== "FT", `extras status ${extrasLive.statusShort}`);
assert(
  resolveMatchStatusFromScoreboard("ongoing", extrasLive) === "ongoing",
  "PLAY B10 stays ongoing",
);
assert(
  resolveMatchStatusFromScoreboard("completed", extrasLive) === "ongoing",
  "PLAY B10 reopens false complete",
);

const tiedEndAfterNine = parseDaumLiveScoreboard(
  game({
    gameStatus: "END",
    periodType: "END",
    awayRun: 3,
    homeRun: 3,
    awayInn: "0,1,1,0,0,0,0,0,1",
    homeInn: "0,0,0,0,0,0,0,3,0",
  }),
);
assert(tiedEndAfterNine.statusShort !== "FT", `tied 9 END status ${tiedEndAfterNine.statusShort}`);
assert(tiedEndAfterNine.inningLabel !== "경기 종료", tiedEndAfterNine.inningLabel);
assert(
  resolveMatchStatusFromScoreboard("ongoing", tiedEndAfterNine) === "ongoing",
  "tied 9th END must not complete",
);
assert(
  shouldKeepPollingCompletedKboGame({
    homeScore: 3,
    awayScore: 3,
    inning: 9,
    statusShort: "FT",
  }),
  "keep polling tied completed",
);
assert(
  shouldKeepPollingCompletedKboGame({
    homeScore: 3,
    awayScore: 4,
    inning: 10,
    statusShort: "FT",
    homeInnings: { "10": 0 },
    awayInnings: { "10": 1 },
  }),
  "keep polling if extra-inning columns exist",
);

const regulationEnd = parseDaumLiveScoreboard(
  game({
    gameStatus: "END",
    periodType: "END",
    awayRun: 5,
    homeRun: 8,
    awayInn: "0,0,0,0,5,0,0,0,0",
    homeInn: "1,0,1,0,0,2,0,0,4",
  }),
);
assert(regulationEnd.statusShort === "FT", regulationEnd.statusShort);
assert(regulationEnd.inningLabel === "경기 종료", regulationEnd.inningLabel);
assert(
  resolveMatchStatusFromScoreboard("ongoing", regulationEnd) === "completed",
  "5-8 END is complete",
);

const skipBottomNine = parseDaumLiveScoreboard(
  game({
    gameStatus: "END",
    periodType: "END",
    awayRun: 1,
    homeRun: 7,
    awayInn: "0,0,1,0,0,0,0,0,0",
    homeInn: "0,1,0,0,0,6,0,0",
  }),
);
assert(skipBottomNine.statusShort === "FT", "home already winning after top 9 is FT");
assert(
  resolveMatchStatusFromScoreboard("ongoing", skipBottomNine) === "completed",
  "skip bottom 9 complete",
);

const extras11tied = parseDaumLiveScoreboard(
  game({
    gameStatus: "PLAY",
    periodType: "B11",
    awayRun: 3,
    homeRun: 3,
    awayInn: "0,0,0,1,0,0,0,2,0,0,0",
    homeInn: "1,0,1,0,0,0,1,0,0,0,0",
  }),
);
assert(extras11tied.inning === 11, `11 inning ${extras11tied.inning}`);
assert(extras11tied.inningLabel === "11회 말", extras11tied.inningLabel);
assert(resolveMatchStatusFromScoreboard("ongoing", extras11tied) === "ongoing", "11th stays live");

assert(
  !shouldTreatKboScoreboardAsFinal({
    statusShort: "FT",
    periodType: "B10",
    inning: 10,
    inningHalf: "bottom",
    homeScore: 3,
    awayScore: 4,
  }),
  "live B10 is not final",
);

assert(
  shouldTreatKboScoreboardAsFinal({
    statusShort: "FT",
    periodType: "END",
    inning: 12,
    inningHalf: "bottom",
    homeScore: 4,
    awayScore: 4,
  }),
  "12th inning tie can be final",
);

console.log("OK: kbo extra innings are not treated as game over");
