/**
 * 우천 중단 vs 취소·연기
 * 실행: npx tsx scripts/test-game-suspend.ts
 */
import "./test-env";
import {
  isGameLiveStatus,
  isGamePostponedOrCancelled,
  isGameSuspendedStatus,
  isConfirmedPostponedMatch,
} from "../shared/apiSportsStatus";
import {
  applyWeatherDelayHint,
  isGameSuspendedScoreboard,
  isMatchPredictionSuspended,
  naverRelaysIndicateWeatherDelay,
  textIndicatesWeatherDelay,
  GAME_SUSPENDED_OPERATOR_MESSAGE,
} from "../shared/gameSuspend";
import { mapDaumGameStatus, parseDaumLiveScoreboard } from "../server/daumLive/parseDaumLiveScoreboard";
import { resolveMatchStatusFromScoreboard } from "../server/apiSports/syncService";
import { resolveMatchManagementStatusDisplay } from "../shared/matchManagementStatus";
import { deriveOperatorNextAction } from "../shared/operatorNextAction";
import { resolveGameDayOverlayKind } from "../client/src/lib/gameDayPhase";
import {
  canRemainInGameMatch,
  isMatchSelectableForGame,
  type GameMatchItem,
} from "../client/src/components/game/gameMatchUtils";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isGamePostponedOrCancelled("SUSP") === false, "SUSP is not cancelled");
assert(isGamePostponedOrCancelled("PST") === true, "PST is postponed");
assert(isGamePostponedOrCancelled("CAN") === true, "CAN is cancelled");
assert(isGameSuspendedStatus("SUSP") === true, "SUSP is suspended");
assert(isGameSuspendedStatus("DELAY") === true, "DELAY is suspended");
assert(isGameLiveStatus("SUSP") === false, "SUSP is not live play");
assert(isGameLiveStatus("IN") === true, "IN is live");
assert(
  isConfirmedPostponedMatch({ inningLabel: "중단" }) === false,
  "중단 label is not postponed",
);
assert(
  isConfirmedPostponedMatch({ inningLabel: "연기" }) === true,
  "연기 label is postponed",
);

assert(mapDaumGameStatus("SUSPEND").statusShort === "SUSP", "Daum SUSPEND → SUSP");
assert(mapDaumGameStatus("DELAY").statusShort === "SUSP", "Daum DELAY → SUSP not PST");
assert(mapDaumGameStatus("POSTPONE").statusShort === "PST", "Daum POSTPONE → PST");
assert(mapDaumGameStatus("중단").statusShort === "SUSP", "Korean 중단 → SUSP");
assert(mapDaumGameStatus("우천취소").statusShort === "CAN", "우천취소 → CAN");

const rainDelay = parseDaumLiveScoreboard({
  gameStatus: "SUSPEND",
  periodType: "T5",
  homeScore: { run: 2, inning: "0,0,0,1,1" },
  awayScore: { run: 8, inning: "2,1,3,0,2" },
  home: { team: { nameKo: "롯데", shortNameKo: "롯데" } },
  away: { team: { nameKo: "LG", shortNameKo: "LG" } },
});
assert(rainDelay.statusShort === "SUSP", "mid-game suspend keeps SUSP");
assert(
  resolveMatchStatusFromScoreboard("cancelled", rainDelay) === "ongoing",
  "wrong cancel during rain delay recovers to ongoing",
);
assert(
  resolveMatchManagementStatusDisplay({
    matchStatus: "ongoing",
    statusShort: rainDelay.statusShort,
    statusLong: rainDelay.statusLong,
    inningLabel: rainDelay.inningLabel,
    homeScore: rainDelay.homeScore,
    awayScore: rainDelay.awayScore,
    inning: rainDelay.inning,
  }) === "중단",
  "admin list shows 중단",
);

const resumePlay = parseDaumLiveScoreboard({
  gameStatus: "PLAY",
  periodType: "T5",
  homeScore: { run: 2, inning: "0,0,0,1,1" },
  awayScore: { run: 8, inning: "2,1,3,0,2" },
  home: { team: { nameKo: "롯데", shortNameKo: "롯데" } },
  away: { team: { nameKo: "LG", shortNameKo: "LG" } },
});
assert(resumePlay.statusShort !== "SUSP", "PLAY is not SUSP");
assert(
  resolveMatchStatusFromScoreboard("ongoing", resumePlay) === "ongoing",
  "resume stays ongoing",
);

assert(textIndicatesWeatherDelay("우천으로 경기가 중단되었습니다") === true, "naver rain text");
assert(textIndicatesWeatherDelay("우천취소") === false, "우천취소 is not delay");
assert(
  naverRelaysIndicateWeatherDelay([
    { title: "5회초", textOptions: [{ text: "스트라이크" }] },
    { title: "경기 중단", textOptions: [{ text: "우천으로 경기가 중단되었습니다" }] },
  ]) === true,
  "last relay rain delay",
);
assert(
  naverRelaysIndicateWeatherDelay([
    { title: "경기 중단", textOptions: [{ text: "우천으로 경기가 중단되었습니다" }] },
    { title: "5회초", textOptions: [{ text: "볼" }] },
  ]) === false,
  "new pitch after delay is resume",
);

const hinted = applyWeatherDelayHint({ statusShort: "IN", statusLong: "In Progress" }, true);
assert(hinted.statusShort === "SUSP", "PLAY + naver hint → SUSP");
assert(
  applyWeatherDelayHint({ statusShort: "FT", statusLong: "Game Finished" }, true).statusShort ===
    "FT",
  "do not suspend a finished game",
);
assert(
  applyWeatherDelayHint({ statusShort: "CAN", statusLong: "Cancelled" }, true).statusShort === "CAN",
  "do not suspend a cancelled game",
);

assert(
  isGameSuspendedScoreboard({ statusShort: "SUSP", inningLabel: "5회 초" }) === true,
  "SUSP with inning is delay",
);
assert(
  isMatchPredictionSuspended({
    matchStatus: "ongoing",
    liveScoreboard: { statusShort: "SUSP" },
  }) === true,
  "ongoing + SUSP blocks prediction",
);
assert(
  isMatchPredictionSuspended({
    matchStatus: "cancelled",
    liveScoreboard: { statusShort: "SUSP" },
  }) === false,
  "cancelled match uses cancel path",
);
assert(GAME_SUSPENDED_OPERATOR_MESSAGE.includes("재개"), "operator message mentions resume");

assert(
  deriveOperatorNextAction({ atBatPhase: "idle", gameSuspended: true }).kind === "none",
  "operator next action waits on rain delay",
);

const liveOn: GameMatchItem = {
  id: "m2",
  name: "2경기",
  stadiumName: "사직",
  stadiumId: 1,
  startTime: new Date().toISOString(),
  matchStatus: "ongoing",
  sideBetEnabled: true,
  liveScoreboard: {
    statusShort: "SUSP",
    statusLong: "Suspended",
    inningLabel: "5회 초",
    homeScore: 2,
    awayScore: 8,
  } as GameMatchItem["liveScoreboard"],
};
assert(canRemainInGameMatch(liveOn) === true, "rain delay stays in prediction screen");
assert(isMatchSelectableForGame(liveOn) === true, "rain delay is still selectable to wait");

const cancelled: GameMatchItem = { ...liveOn, matchStatus: "cancelled", liveScoreboard: { statusShort: "CAN" } as GameMatchItem["liveScoreboard"] };
assert(canRemainInGameMatch(cancelled) === false, "cancel still drops the screen");

const rainCancel = parseDaumLiveScoreboard({
  gameStatus: "CANCEL",
  periodType: "T5",
  homeScore: { run: 2, inning: "0,0,0,1,1" },
  awayScore: { run: 8, inning: "2,1,3,0,2" },
  home: { team: { nameKo: "롯데", shortNameKo: "롯데" } },
  away: { team: { nameKo: "LG", shortNameKo: "LG" } },
});
assert(rainCancel.statusShort === "CAN", "cancel stays CAN");
assert(
  resolveMatchStatusFromScoreboard("ongoing", rainCancel) === "cancelled",
  "official cancel sets cancelled",
);

assert(
  resolveGameDayOverlayKind([liveOn], false) === null,
  "day overlay does not treat rain delay as cancel/end",
);

console.log("OK: rain delay pauses prediction without ending the match");
