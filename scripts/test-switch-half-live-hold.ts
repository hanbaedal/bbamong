/**
 * 공수교대: 운영자 3아웃 + 실황 0~2아웃이면 보류, force 또는 실황 3아웃/초말 변경이면 허용.
 * 실행: npx tsx scripts/test-switch-half-live-hold.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import type { LiveScoreboard } from "../shared/apiSportsTypes";
import { MatchModel, RoundStatisticsModel } from "../server/UserStorage/db";
import {
  advanceInningHalf,
  assertRoundResultSentOrAllowAdvance,
  startRound,
} from "../server/liveMatch/predictionStorage";
import {
  clearLiveAutoOperator,
  processLiveAutoOperator,
  notifyManualAtBatAction,
} from "../server/liveMatch/liveAutoOperator";
import { broadcastManager } from "../server/liveMatch/broadcastManager";
import { assertSwitchHalfNotDuringAd, resetSwitchHalfRecentForTest } from "../server/liveMatch/switchHalfAdGuard";

const MATCH_ID = "test-switch-half-live-hold-e07b";
let statsIdSeq = Date.now();

function board(partial: {
  outs?: number | null;
  half?: "top" | "bottom";
  omitSituation?: boolean;
  inning?: number;
}): LiveScoreboard {
  const inning = partial.inning ?? 3;
  const half = partial.half ?? "top";
  return {
    homeTeamName: "홈",
    awayTeamName: "원정",
    homeScore: 0,
    awayScore: 0,
    homeHits: 0,
    awayHits: 0,
    homeErrors: 0,
    awayErrors: 0,
    inning,
    inningHalf: half,
    inningLabel: `${inning}회${half === "top" ? "초" : "말"}`,
    statusShort: "IN",
    statusLong: "In Progress",
    situation: partial.omitSituation
      ? null
      : {
          balls: 0,
          strikes: 0,
          outs: partial.outs ?? 0,
          first: false,
          second: false,
          third: false,
          batterName: "타자A",
          pitcherName: "투수A",
          suggestedResult: null,
        },
    syncedAt: new Date().toISOString(),
  };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function seedMatch(opts: {
  outsInHalf: number;
  inningHalf: "top" | "bottom";
  liveOuts: number | null;
  liveHalf: "top" | "bottom";
  omitSituation?: boolean;
  gameInning?: number;
  liveInning?: number;
  skipRoundStats?: boolean;
  currentRound?: number;
}) {
  await MatchModel.deleteOne({ id: MATCH_ID });
  await RoundStatisticsModel.deleteMany({ matchId: MATCH_ID });
  await MatchModel.create({
    id: MATCH_ID,
    name: "공수교대 실황 보류 테스트",
    stadiumId: 1,
    matchDate: "2026-08-27",
    startTime: new Date(Date.now() - 60_000),
    endTime: new Date(Date.now() + 3 * 3600_000),
    matchStatus: "ongoing",
    currentRound: opts.currentRound ?? 1,
    predictionEnabled: false,
    liveAutoEnabled: true,
    outsInHalf: opts.outsInHalf,
    gameInning: opts.gameInning ?? 3,
    inningHalf: opts.inningHalf,
    batterIndexInHalf: 1,
    awayBatterOrder: 1,
    homeBatterOrder: 1,
    controlMode: "auto",
    liveScoreboard: board({
      outs: opts.liveOuts ?? undefined,
      half: opts.liveHalf,
      omitSituation: opts.omitSituation || opts.liveOuts == null,
      inning: opts.liveInning ?? opts.gameInning ?? 3,
    }),
  });
  if (!opts.skipRoundStats) {
    await RoundStatisticsModel.create({
      id: ++statsIdSeq,
      matchId: MATCH_ID,
      roundNumber: opts.currentRound ?? 1,
      isPredictionStarted: true,
      isPredictionStopped: true,
      isResultSent: true,
    });
  }
}

async function expectHold() {
  const before = await MatchModel.findOne({ id: MATCH_ID }).select("inningHalf outsInHalf").lean();
  try {
    await advanceInningHalf(MATCH_ID);
    throw new Error("expected hold");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    assert(msg.includes("한 번 더"), `hold message, got: ${msg}`);
    assert(msg.includes("실황"), `mentions live, got: ${msg}`);
  }
  const after = await MatchModel.findOne({ id: MATCH_ID }).select("inningHalf outsInHalf").lean();
  assert((after as { inningHalf?: string })?.inningHalf === (before as { inningHalf?: string })?.inningHalf, "hold does not change half");
  assert((after as { outsInHalf?: number })?.outsInHalf === (before as { outsInHalf?: number })?.outsInHalf, "hold does not change outs");
}

/** 로컬 mongod는 트랜잭션 불가. hold를 건너뛰면 nextRound에서 이 오류가 난다. */
async function expectHoldSkipped(label: string) {
  try {
    await advanceInningHalf(MATCH_ID);
    throw new Error(`${label}: unexpected success on standalone mongo`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    assert(!msg.includes("한 번 더"), `${label}: should not hold, got: ${msg}`);
    assert(
      msg.includes("Transaction numbers") || msg.includes("결과") || msg.includes("예측"),
      `${label}: expected nextRound error, got: ${msg}`,
    );
  }
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI missing");
  await mongoose.connect(uri);

  await seedMatch({ outsInHalf: 3, inningHalf: "top", liveOuts: 2, liveHalf: "top" });
  await expectHold();
  console.log("OK: live 2 holds switch (match unchanged)");

  await seedMatch({ outsInHalf: 3, inningHalf: "top", liveOuts: 2, liveHalf: "top" });
  try {
    await startRound(MATCH_ID);
    throw new Error("unexpected success on standalone mongo");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    assert(!msg.includes("3아웃"), `start must not treat live 2 as switch, got: ${msg}`);
    assert(!msg.includes("다음 타자"), `start must reopen same at-bat, got: ${msg}`);
    assert(
      msg.includes("Transaction numbers") || msg.includes("예측"),
      `start expected txn/round error, got: ${msg}`,
    );
  }
  console.log("OK: start after result + live 2 is not blocked as 3-out");

  try {
    await advanceInningHalf(MATCH_ID, { force: true });
    throw new Error("unexpected success on standalone mongo");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    assert(!msg.includes("한 번 더"), `force should skip hold, got: ${msg}`);
    assert(
      msg.includes("Transaction numbers") || msg.includes("결과") || msg.includes("예측"),
      `force expected nextRound error, got: ${msg}`,
    );
  }
  console.log("OK: force skips live hold");

  await seedMatch({ outsInHalf: 3, inningHalf: "top", liveOuts: 3, liveHalf: "top" });
  await expectHoldSkipped("live 3");
  console.log("OK: live 3 allows switch");

  await seedMatch({ outsInHalf: 3, inningHalf: "top", liveOuts: 0, liveHalf: "bottom" });
  await expectHoldSkipped("live next half catch-up");
  console.log("OK: live already next half (0-2 outs) allows catch-up switch");

  await seedMatch({
    outsInHalf: 3,
    inningHalf: "top",
    liveOuts: null,
    liveHalf: "top",
    omitSituation: true,
  });
  await expectHoldSkipped("missing live");
  console.log("OK: missing live outs does not hold");

  await seedMatch({ outsInHalf: 3, inningHalf: "top", liveOuts: 3, liveHalf: "top" });
  clearLiveAutoOperator(MATCH_ID);
  await processLiveAutoOperator(
    MATCH_ID,
    board({ outs: 2, half: "top" }),
  );
  const frozen = await MatchModel.findOne({ id: MATCH_ID }).select("inningHalf outsInHalf").lean();
  assert((frozen as { inningHalf?: string })?.inningHalf === "top", "same-half freeze inningHalf");
  assert((frozen as { outsInHalf?: number })?.outsInHalf === 3, "poll does not lower operator 3 to live 2");
  console.log("OK: same-half live 2 does not overwrite operator outs");

  await seedMatch({ outsInHalf: 3, inningHalf: "top", liveOuts: 3, liveHalf: "top" });
  clearLiveAutoOperator(MATCH_ID);
  await processLiveAutoOperator(
    MATCH_ID,
    board({ outs: 1, half: "bottom" }),
  );
  const caught = await MatchModel.findOne({ id: MATCH_ID }).select("inningHalf outsInHalf").lean();
  assert((caught as { inningHalf?: string })?.inningHalf === "top", "poll does not catch-up half");
  assert((caught as { outsInHalf?: number })?.outsInHalf === 3, "poll does not catch-up outs");
  console.log("OK: live 1-out next half leaves operator 3 for the switch-half button");

  await seedMatch({ outsInHalf: 0, inningHalf: "bottom", liveOuts: 3, liveHalf: "top" });
  clearLiveAutoOperator(MATCH_ID);
  await processLiveAutoOperator(MATCH_ID, board({ outs: 3, half: "top" }));
  const noRewind = await MatchModel.findOne({ id: MATCH_ID }).select("inningHalf outsInHalf").lean();
  assert((noRewind as { inningHalf?: string })?.inningHalf === "bottom", "behind live 3 does not rewind half");
  assert((noRewind as { outsInHalf?: number })?.outsInHalf === 0, "behind live 3 does not restore outs");
  console.log("OK: after switch, live still previous half 3 does not rewind");

  await seedMatch({ outsInHalf: 0, inningHalf: "top", liveOuts: 3, liveHalf: "top" });
  clearLiveAutoOperator(MATCH_ID);
  resetSwitchHalfRecentForTest(MATCH_ID);
  await processLiveAutoOperator(MATCH_ID, board({ outs: 3, half: "top" }));
  const midJoin = await MatchModel.findOne({ id: MATCH_ID }).select("inningHalf outsInHalf").lean();
  assert((midJoin as { inningHalf?: string })?.inningHalf === "top", "mid-join keeps same half");
  assert((midJoin as { outsInHalf?: number })?.outsInHalf === 0, "mid-join live 3 does not write outsInHalf");
  console.log("OK: mid-join same-half live 3 does not persist live 3 into outsInHalf");

  await seedMatch({ outsInHalf: 0, inningHalf: "top", liveOuts: 3, liveHalf: "top" });
  resetSwitchHalfRecentForTest(MATCH_ID);
  try {
    await advanceInningHalf(MATCH_ID);
    throw new Error("unexpected success on standalone mongo");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    assert(!msg.includes("3아웃일 때만"), `mid-join live 3 should allow switch, got: ${msg}`);
    assert(
      msg.includes("Transaction numbers") || msg.includes("결과") || msg.includes("예측"),
      `mid-join expected nextRound error, got: ${msg}`,
    );
  }
  console.log("OK: mid-join live 3 passes switch-half 3-out gate");

  await seedMatch({ outsInHalf: 0, inningHalf: "bottom", liveOuts: 3, liveHalf: "bottom" });
  clearLiveAutoOperator(MATCH_ID);
  notifyManualAtBatAction(MATCH_ID, "switch");
  await processLiveAutoOperator(MATCH_ID, board({ outs: 3, half: "bottom" }));
  const noRestore = await MatchModel.findOne({ id: MATCH_ID }).select("inningHalf outsInHalf").lean();
  assert((noRestore as { inningHalf?: string })?.inningHalf === "bottom", "same-half live 3 after switch keeps half");
  assert((noRestore as { outsInHalf?: number })?.outsInHalf === 0, "same-half live 3 after switch does not restore outs");
  console.log("OK: after switch, live 3 on new half does not restore 3 outs");

  await seedMatch({
    outsInHalf: 0,
    inningHalf: "top",
    liveOuts: 3,
    liveHalf: "bottom",
    gameInning: 4,
    liveInning: 3,
  });
  clearLiveAutoOperator(MATCH_ID);
  await processLiveAutoOperator(MATCH_ID, board({ outs: 3, half: "bottom", inning: 3 }));
  const nextInning = await MatchModel.findOne({ id: MATCH_ID }).select("inningHalf outsInHalf gameInning").lean();
  assert((nextInning as { inningHalf?: string })?.inningHalf === "top", "말→초 switch is not rewound to previous bottom");
  assert((nextInning as { outsInHalf?: number })?.outsInHalf === 0, "말→초 switch keeps 0 outs");
  console.log("OK: after 말→초 switch, previous-bottom live 3 does not rewind");

  await seedMatch({ outsInHalf: 3, inningHalf: "top", liveOuts: 3, liveHalf: "top" });
  broadcastManager.resetAdBreakForTest(MATCH_ID);
  const scheduled = broadcastManager.tryScheduleAdBreak(MATCH_ID, { force: true, reason: "switch_half" });
  assert(scheduled, "ad break scheduled");
  assert(broadcastManager.isAdBreakActive(MATCH_ID), "intro counts as ad break");
  try {
    assertSwitchHalfNotDuringAd(MATCH_ID);
    throw new Error("expected reject during ad break");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    assert(msg.includes("광고") || msg.includes("이미 반영"), `ad-break reject, got: ${msg}`);
  }
  const duringAd = await MatchModel.findOne({ id: MATCH_ID }).select("inningHalf outsInHalf").lean();
  assert((duringAd as { inningHalf?: string })?.inningHalf === "top", "ad-break reject does not change half");
  assert((duringAd as { outsInHalf?: number })?.outsInHalf === 3, "ad-break reject does not change outs");
  broadcastManager.resetAdBreakForTest(MATCH_ID);
  console.log("OK: switch-half during ad intro is rejected");

  await seedMatch({ outsInHalf: 0, inningHalf: "bottom", liveOuts: 3, liveHalf: "top" });
  broadcastManager.resetAdBreakForTest(MATCH_ID);
  broadcastManager.tryScheduleAdBreak(MATCH_ID, { force: true, reason: "switch_half" });
  clearLiveAutoOperator(MATCH_ID);
  await processLiveAutoOperator(MATCH_ID, board({ outs: 3, half: "top" }));
  const adSync = await MatchModel.findOne({ id: MATCH_ID }).select("inningHalf outsInHalf").lean();
  assert((adSync as { inningHalf?: string })?.inningHalf === "bottom", "ad-break sync does not rewind half");
  assert((adSync as { outsInHalf?: number })?.outsInHalf === 0, "ad-break sync does not restore outs");
  broadcastManager.resetAdBreakForTest(MATCH_ID);
  console.log("OK: live sync during ad break does not rewind switch");

  await seedMatch({
    outsInHalf: 2,
    inningHalf: "top",
    liveOuts: 2,
    liveHalf: "top",
    gameInning: 1,
    liveInning: 2,
    skipRoundStats: true,
    currentRound: 2,
  });
  await assertRoundResultSentOrAllowAdvance(MATCH_ID, 2, {
    allowIfPredictionNeverStarted: true,
  });
  try {
    await assertRoundResultSentOrAllowAdvance(MATCH_ID, 2);
    throw new Error("next-batter must still require a started round");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    assert(msg.includes("예측을 시작"), `next-batter still needs start, got: ${msg}`);
  }
  resetSwitchHalfRecentForTest(MATCH_ID);
  const caughtUp = await advanceInningHalf(MATCH_ID);
  const caughtDoc = caughtUp.match as {
    gameInning?: number;
    inningHalf?: string;
    outsInHalf?: number;
    currentRound?: number;
  };
  assert(caughtDoc.gameInning === 2, `catch-up inning, got ${caughtDoc.gameInning}`);
  assert(caughtDoc.inningHalf === "top", `catch-up half, got ${caughtDoc.inningHalf}`);
  assert(caughtDoc.outsInHalf === 0, `catch-up resets outs, got ${caughtDoc.outsInHalf}`);
  assert(caughtDoc.currentRound === 3, `unplayed round increments, got ${caughtDoc.currentRound}`);
  console.log("OK: unplayed round catch-up switch skips result (standalone)");

  await seedMatch({
    outsInHalf: 2,
    inningHalf: "top",
    liveOuts: 2,
    liveHalf: "top",
    gameInning: 1,
    liveInning: 2,
    currentRound: 2,
  });
  await RoundStatisticsModel.updateOne(
    { matchId: MATCH_ID, roundNumber: 2 },
    { $set: { isResultSent: false, isPredictionStopped: true, isPredictionStarted: true } },
  );
  try {
    await assertRoundResultSentOrAllowAdvance(MATCH_ID, 2, {
      allowIfPredictionNeverStarted: true,
    });
    throw new Error("started round must still require result on switch-half");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    assert(msg.includes("결과"), `started round still needs result, got: ${msg}`);
  }
  console.log("OK: started round still requires result before switch-half");

  await MatchModel.deleteOne({ id: MATCH_ID });
  await RoundStatisticsModel.deleteMany({ matchId: MATCH_ID });
  clearLiveAutoOperator(MATCH_ID);
  broadcastManager.resetAdBreakForTest(MATCH_ID);
  resetSwitchHalfRecentForTest(MATCH_ID);
  await mongoose.disconnect();
  console.log("OK: switch-half live hold");
}

main().catch(async (e) => {
  console.error(e);
  try {
    await MatchModel.deleteOne({ id: MATCH_ID });
    await RoundStatisticsModel.deleteMany({ matchId: MATCH_ID });
    clearLiveAutoOperator(MATCH_ID);
    broadcastManager.resetAdBreakForTest(MATCH_ID);
    resetSwitchHalfRecentForTest(MATCH_ID);
    await mongoose.disconnect();
  } catch {
    /* */
  }
  process.exit(1);
});
