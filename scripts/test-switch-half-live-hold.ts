/**
 * 공수교대: 운영자 3아웃 + 실황 0~2아웃이면 보류, force 또는 실황 3아웃/초말 변경이면 허용.
 * 실행: npx tsx scripts/test-switch-half-live-hold.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import type { LiveScoreboard } from "../shared/apiSportsTypes";
import { MatchModel, RoundStatisticsModel } from "../server/UserStorage/db";
import { advanceInningHalf } from "../server/liveMatch/predictionStorage";
import {
  clearLiveAutoOperator,
  processLiveAutoOperator,
} from "../server/liveMatch/liveAutoOperator";

const MATCH_ID = "test-switch-half-live-hold-e07b";
let statsIdSeq = Date.now();

function board(partial: { outs?: number | null; half?: "top" | "bottom"; omitSituation?: boolean }): LiveScoreboard {
  return {
    homeTeamName: "홈",
    awayTeamName: "원정",
    homeScore: 0,
    awayScore: 0,
    homeHits: 0,
    awayHits: 0,
    homeErrors: 0,
    awayErrors: 0,
    inning: 3,
    inningHalf: partial.half ?? "top",
    inningLabel: "3회초",
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
    currentRound: 1,
    predictionEnabled: false,
    liveAutoEnabled: true,
    outsInHalf: opts.outsInHalf,
    gameInning: 3,
    inningHalf: opts.inningHalf,
    batterIndexInHalf: 1,
    awayBatterOrder: 1,
    homeBatterOrder: 1,
    controlMode: "auto",
    liveScoreboard: board({
      outs: opts.liveOuts ?? undefined,
      half: opts.liveHalf,
      omitSituation: opts.omitSituation || opts.liveOuts == null,
    }),
  });
  await RoundStatisticsModel.create({
    id: ++statsIdSeq,
    matchId: MATCH_ID,
    roundNumber: 1,
    isPredictionStarted: true,
    isPredictionStopped: true,
    isResultSent: true,
  });
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
  await expectHoldSkipped("half changed");
  console.log("OK: live half already changed allows switch");

  await seedMatch({
    outsInHalf: 3,
    inningHalf: "top",
    liveOuts: null,
    liveHalf: "top",
    omitSituation: true,
  });
  await expectHoldSkipped("missing live");
  console.log("OK: missing live outs does not hold");

  await seedMatch({ outsInHalf: 3, inningHalf: "top", liveOuts: 2, liveHalf: "top" });
  clearLiveAutoOperator(MATCH_ID);
  await processLiveAutoOperator(
    MATCH_ID,
    board({ outs: 0, half: "bottom" }),
  );
  const frozen = await MatchModel.findOne({ id: MATCH_ID }).select("inningHalf outsInHalf").lean();
  assert((frozen as { inningHalf?: string })?.inningHalf === "top", "3-out freeze inningHalf");
  assert(((frozen as { outsInHalf?: number })?.outsInHalf ?? 0) >= 3, "live 0 does not cut operator 3");
  console.log("OK: live poll does not overwrite operator half/outs while 3 outs");

  await MatchModel.deleteOne({ id: MATCH_ID });
  await RoundStatisticsModel.deleteMany({ matchId: MATCH_ID });
  clearLiveAutoOperator(MATCH_ID);
  await mongoose.disconnect();
  console.log("OK: switch-half live hold");
}

main().catch(async (e) => {
  console.error(e);
  try {
    await MatchModel.deleteOne({ id: MATCH_ID });
    await RoundStatisticsModel.deleteMany({ matchId: MATCH_ID });
    clearLiveAutoOperator(MATCH_ID);
    await mongoose.disconnect();
  } catch {
    /* */
  }
  process.exit(1);
});
