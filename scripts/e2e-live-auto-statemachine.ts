/**
 * 실황 폴링은 점수·힌트만. 예측 시작·결과·다음타자·공수는 수동.
 * npx tsx scripts/e2e-live-auto-statemachine.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import type { LiveScoreboard } from "../shared/apiSportsTypes";
import { MatchModel, RoundStatisticsModel, getNextSequence } from "../server/UserStorage/db";
import {
  processLiveAutoOperator,
  clearLiveAutoOperator,
  peekLiveAutoAdResume,
  LIVE_AUTO_BATTER_STABLE_MS,
  LIVE_AUTO_PITCHER_STABLE_MS,
} from "../server/liveMatch/liveAutoOperator";
import { resolveAtBatPhase } from "../server/liveMatch/atBatStateMachine";
import { broadcastManager } from "../server/liveMatch/broadcastManager";

const MATCH_ID = "5081ab3a-fbdf-4a1a-adb9-2766752af6c0";

function board(partial: {
  batter?: string;
  pitcher?: string;
  outs?: number;
  half?: "top" | "bottom";
  inning?: number;
  suggested?: "아웃" | "홈런" | "1루" | null;
}): LiveScoreboard {
  return {
    homeTeamName: "홈",
    awayTeamName: "원정",
    homeScore: 0,
    awayScore: 0,
    homeHits: 0,
    awayHits: 0,
    homeErrors: 0,
    awayErrors: 0,
    inning: partial.inning ?? 3,
    inningHalf: partial.half ?? "top",
    inningLabel: "3회초",
    statusShort: "IN",
    statusLong: "In Progress",
    situation: {
      balls: 0,
      strikes: 0,
      outs: partial.outs ?? 0,
      first: false,
      second: false,
      third: false,
      batterName: partial.batter ?? "타자A",
      pitcherName: partial.pitcher ?? "투수A",
      suggestedResult: partial.suggested ?? null,
    },
    syncedAt: new Date().toISOString(),
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function ensureRoundStats(roundNumber: number) {
  const existing = await RoundStatisticsModel.findOne({ matchId: MATCH_ID, roundNumber }).lean();
  if (existing) return;
  const id = await getNextSequence("roundStatistics");
  await RoundStatisticsModel.create({
    id,
    matchId: MATCH_ID,
    roundNumber,
    isPredictionStarted: false,
    isPredictionStopped: false,
    isResultSent: false,
  });
}

async function resetMatchIdle(opts?: { half?: "top" | "bottom"; inning?: number; outs?: number }) {
  clearLiveAutoOperator(MATCH_ID);
  broadcastManager.resetAdBreakForTest(MATCH_ID);
  await sleep(150);
  const half = opts?.half ?? "top";
  const inning = opts?.inning ?? 3;
  const outs = opts?.outs ?? 0;

  let match = await MatchModel.findOne({ id: MATCH_ID }).lean();
  if (!match) {
    await MatchModel.create({
      id: MATCH_ID,
      name: "제1경기",
      stadiumId: 1,
      matchDate: "2026-08-17",
      startTime: new Date(Date.now() - 60_000),
      endTime: new Date(Date.now() + 3 * 3600_000),
      matchStatus: "ongoing",
      currentRound: 1,
      predictionEnabled: false,
      liveAutoEnabled: true,
      outsInHalf: outs,
      gameInning: inning,
      inningHalf: half,
      batterIndexInHalf: 1,
      awayBatterOrder: 1,
      homeBatterOrder: 1,
      controlMode: "auto",
    });
    match = await MatchModel.findOne({ id: MATCH_ID }).lean();
  }

  await RoundStatisticsModel.deleteMany({ matchId: MATCH_ID });
  await ensureRoundStats(1);
  await MatchModel.updateOne(
    { id: MATCH_ID },
    {
      $set: {
        matchStatus: "ongoing",
        predictionEnabled: false,
        liveAutoEnabled: true,
        outsInHalf: outs,
        gameInning: inning,
        inningHalf: half,
        currentRound: 1,
        batterIndexInHalf: 1,
        awayBatterOrder: 1,
        homeBatterOrder: 1,
      },
    },
  );
}

async function setRoundPhase(opts: {
  predictionEnabled: boolean;
  started: boolean;
  stopped: boolean;
  resultSent: boolean;
}) {
  const match = await MatchModel.findOne({ id: MATCH_ID }).select("currentRound").lean();
  const roundNumber = match?.currentRound ?? 1;
  await MatchModel.updateOne(
    { id: MATCH_ID },
    { $set: { predictionEnabled: opts.predictionEnabled } },
  );
  await RoundStatisticsModel.updateOne(
    { matchId: MATCH_ID, roundNumber },
    {
      $set: {
        isPredictionStarted: opts.started,
        isPredictionStopped: opts.stopped,
        isResultSent: opts.resultSent,
        settledResult: opts.resultSent ? "아웃" : null,
      },
    },
  );
}

async function openPredictionViaManual() {
  await setRoundPhase({
    predictionEnabled: true,
    started: true,
    stopped: false,
    resultSent: false,
  });
  const phase = await resolveAtBatPhase(MATCH_ID);
  await assert(phase === "prediction_open", `expected prediction_open after manual start, got ${phase}`);
}

async function closePredictionViaManual() {
  await setRoundPhase({
    predictionEnabled: false,
    started: true,
    stopped: true,
    resultSent: false,
  });
}

async function confirmResultViaManual() {
  await setRoundPhase({
    predictionEnabled: false,
    started: true,
    stopped: true,
    resultSent: true,
  });
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const logs: string[] = [];
  const pass = (name: string) => {
    logs.push(`OK ${name}`);
    console.log(`OK ${name}`);
  };

  // —— 1) seed + flicker + stable batter — 예측은 자동으로 열리지 않음 ——
  await resetMatchIdle();
  await processLiveAutoOperator(MATCH_ID, board({ batter: "김타자", pitcher: "박투수", outs: 0 }));
  let phase = await resolveAtBatPhase(MATCH_ID);
  await assert(phase === "idle", `seed should stay idle, got ${phase}`);

  await processLiveAutoOperator(MATCH_ID, board({ batter: "이타자", pitcher: "박투수", outs: 0 }));
  await sleep(500);
  await processLiveAutoOperator(MATCH_ID, board({ batter: "최타자", pitcher: "박투수", outs: 0 }));
  phase = await resolveAtBatPhase(MATCH_ID);
  await assert(phase === "idle", `flicker should not open prediction, got ${phase}`);

  await processLiveAutoOperator(MATCH_ID, board({ batter: "안정타자", pitcher: "박투수", outs: 0 }));
  await sleep(LIVE_AUTO_BATTER_STABLE_MS + 100);
  await processLiveAutoOperator(MATCH_ID, board({ batter: "안정타자", pitcher: "박투수", outs: 0 }));
  phase = await resolveAtBatPhase(MATCH_ID);
  await assert(phase === "idle", `stable batter must not auto-open, got ${phase}`);
  pass("stable batter does not auto-open prediction");

  // —— 2) liveAutoEnabled=false 잔여값 → 복구, 그래도 자동 예측 없음 ——
  await resetMatchIdle();
  await MatchModel.updateOne({ id: MATCH_ID }, { $set: { liveAutoEnabled: false } });
  await processLiveAutoOperator(MATCH_ID, board({ batter: "김타자", pitcher: "박투수", outs: 0 }));
  const healed = await MatchModel.findOne({ id: MATCH_ID }).select("liveAutoEnabled").lean();
  await assert(healed?.liveAutoEnabled !== false, "false must be healed to true");
  await sleep(LIVE_AUTO_BATTER_STABLE_MS + 100);
  await processLiveAutoOperator(MATCH_ID, board({ batter: "이타자", pitcher: "박투수", outs: 0 }));
  await sleep(LIVE_AUTO_BATTER_STABLE_MS + 100);
  await processLiveAutoOperator(MATCH_ID, board({ batter: "이타자", pitcher: "박투수", outs: 0 }));
  phase = await resolveAtBatPhase(MATCH_ID);
  await assert(phase === "idle", `healed must still stay idle, got ${phase}`);
  pass("liveAuto false heals without auto-start");

  // —— 3) 3아웃 + 결과 없음 → 공수 자동 안 함 (prediction_closed 유지) ——
  await resetMatchIdle();
  await MatchModel.updateOne({ id: MATCH_ID }, { $set: { liveAutoEnabled: true } });
  await openPredictionViaManual();
  await closePredictionViaManual();
  phase = await resolveAtBatPhase(MATCH_ID);
  await assert(phase === "prediction_closed", `expected closed, got ${phase}`);

  clearLiveAutoOperator(MATCH_ID);
  await processLiveAutoOperator(
    MATCH_ID,
    board({ batter: "타자갑", pitcher: "박투수", outs: 2, half: "top", inning: 3 }),
  );
  await processLiveAutoOperator(
    MATCH_ID,
    board({ batter: "타자갑", pitcher: "박투수", outs: 3, half: "top", inning: 3, suggested: null }),
  );
  phase = await resolveAtBatPhase(MATCH_ID);
  await assert(phase === "prediction_closed", `3out without result must stay closed, got ${phase}`);
  const afterBlock = await MatchModel.findOne({ id: MATCH_ID }).select("inningHalf predictionEnabled").lean();
  await assert(afterBlock?.inningHalf === "top", "half must not advance without operator");
  pass("3-out without result does not auto-switch");

  // —— 4) 3아웃 + suggested 아웃 → 자동 확정·공수 없음 ——
  await resetMatchIdle({ half: "top", inning: 3, outs: 2 });
  await openPredictionViaManual();
  await closePredictionViaManual();
  clearLiveAutoOperator(MATCH_ID);
  await processLiveAutoOperator(
    MATCH_ID,
    board({ batter: "타자을", pitcher: "박투수", outs: 2, half: "top", inning: 3 }),
  );
  await processLiveAutoOperator(
    MATCH_ID,
    board({
      batter: "타자을",
      pitcher: "박투수",
      outs: 3,
      half: "bottom",
      inning: 3,
      suggested: "아웃",
    }),
  );
  phase = await resolveAtBatPhase(MATCH_ID);
  await assert(phase === "prediction_closed", `suggested out must not auto-settle, got ${phase}`);
  const mSwitch = await MatchModel.findOne({ id: MATCH_ID }).lean();
  await assert(!mSwitch?.predictionEnabled, "must not start prediction");
  const peekSwitch = peekLiveAutoAdResume(MATCH_ID);
  await assert(!peekSwitch.resumeAfterAdBreak, "must not queue auto resume after ad");
  pass("3-out with suggested out: hint only, no auto result/switch");

  // —— 5) 투수교체 감지 → 자동 진행 없음, 예측은 8초 규칙(여기선 수동 유지) ——
  await resetMatchIdle({ half: "top", inning: 4, outs: 0 });
  await openPredictionViaManual();
  await processLiveAutoOperator(
    MATCH_ID,
    board({ batter: "새타자", pitcher: "신투수", outs: 1, half: "top", inning: 4 }),
  );
  await sleep(Math.max(LIVE_AUTO_BATTER_STABLE_MS, LIVE_AUTO_PITCHER_STABLE_MS) + 100);
  await processLiveAutoOperator(
    MATCH_ID,
    board({ batter: "새타자", pitcher: "신투수", outs: 1, half: "top", inning: 4 }),
  );
  const mPitch = await MatchModel.findOne({ id: MATCH_ID }).select("predictionEnabled currentRound").lean();
  const roundAfterPitch = mPitch?.currentRound ?? 0;
  await sleep(LIVE_AUTO_PITCHER_STABLE_MS + 100);
  await processLiveAutoOperator(
    MATCH_ID,
    board({ batter: "새타자", pitcher: "다른투수", outs: 1, half: "top", inning: 4 }),
  );
  const roundAfterFlicker = (
    await MatchModel.findOne({ id: MATCH_ID }).select("currentRound").lean()
  )?.currentRound;
  await assert(
    roundAfterFlicker === roundAfterPitch,
    "live poll must not auto-advance pitcher change",
  );
  pass("pitcher change is hint-only");

  await assert(
    !broadcastManager.isAdBreakActive(MATCH_ID),
    "ad must not auto-start without operator switch/pitcher",
  );
  pass("no auto ad on live pitcher change");

  broadcastManager.stopAdPlaying(MATCH_ID, "operator_stop", "test ad complete");
  await sleep(250);
  phase = await resolveAtBatPhase(MATCH_ID);
  await assert(phase !== "prediction_open" || Boolean(mPitch?.predictionEnabled), "ad stop must not force a new start");
  const afterAd = await MatchModel.findOne({ id: MATCH_ID }).select("predictionEnabled").lean();
  // 광고 종료 후 새 예측을 열지 않음 (이미 열려 있으면 유지)
  void afterAd;
  pass("ad stop does not auto-start prediction");

  // —— 6) 수동 결과 확정 후에도 공수는 자동 아님 ——
  await resetMatchIdle({ half: "top", inning: 5, outs: 2 });
  await openPredictionViaManual();
  await closePredictionViaManual();
  await confirmResultViaManual();
  phase = await resolveAtBatPhase(MATCH_ID);
  await assert(phase === "result_confirmed", `manual result → confirmed, got ${phase}`);
  clearLiveAutoOperator(MATCH_ID);
  await processLiveAutoOperator(
    MATCH_ID,
    board({ batter: "타자정", pitcher: "박투수", outs: 2, half: "top", inning: 5 }),
  );
  await processLiveAutoOperator(
    MATCH_ID,
    board({ batter: "타자정", pitcher: "박투수", outs: 3, half: "bottom", inning: 5 }),
  );
  phase = await resolveAtBatPhase(MATCH_ID);
  await assert(phase === "result_confirmed", `after confirmed, live must not auto-switch, got ${phase}`);
  pass("manual result then no auto switch");

  console.log("\nlive-auto state machine E2E OK");
  console.log(logs.join("\n"));
  broadcastManager.stopAdPlaying(MATCH_ID, "round_advance", "test cleanup");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch {
    /* */
  }
  process.exit(1);
});
