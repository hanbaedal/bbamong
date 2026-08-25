/**
 * 실황 자동 상태머신 통합 검증 — processLiveAutoOperator 전이/가드
 * npx tsx scripts/e2e-live-auto-statemachine.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import type { LiveScoreboard } from "../shared/apiSportsTypes";
import { MatchModel, RoundStatisticsModel } from "../server/UserStorage/db";
import {
  processLiveAutoOperator,
  clearLiveAutoOperator,
  peekLiveAutoAdResume,
  LIVE_AUTO_BATTER_STABLE_MS,
  LIVE_AUTO_PITCHER_STABLE_MS,
} from "../server/liveMatch/liveAutoOperator";
import { resolveAtBatPhase } from "../server/liveMatch/atBatStateMachine";
import { getNextSequence } from "../server/UserStorage/db";
import { stopRound, updateRoundPredictionResult } from "../server/liveMatch/predictionStorage";
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

async function openPredictionViaAuto(
  batter: string,
  pitcher = "박투수",
  opts?: { half?: "top" | "bottom"; inning?: number },
) {
  const half = opts?.half;
  const inning = opts?.inning;
  // seed 기준선(다른 이름) → 목표 타자 안정화 후에만 prediction_open
  await processLiveAutoOperator(MATCH_ID, board({ batter: "__seed__", pitcher, outs: 0, half, inning }));
  await processLiveAutoOperator(MATCH_ID, board({ batter, pitcher, outs: 0, half, inning }));
  await sleep(LIVE_AUTO_BATTER_STABLE_MS + 100);
  await processLiveAutoOperator(MATCH_ID, board({ batter, pitcher, outs: 0, half, inning }));
  const phase = await resolveAtBatPhase(MATCH_ID);
  await assert(phase === "prediction_open", `expected prediction_open, got ${phase}`);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const logs: string[] = [];
  const pass = (name: string) => {
    logs.push(`OK ${name}`);
    console.log(`OK ${name}`);
  };

  // —— 1) seed + flicker + stable batter ——
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
  await assert(phase === "prediction_open", `stable batter should open, got ${phase}`);
  pass("stable batter opens prediction");

  // —— 2) liveAutoEnabled=false 잔여값 → 자동 복구 후 계속 진행 ——
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
  await assert(phase === "prediction_open", `healed auto should open, got ${phase}`);
  pass("liveAuto false heals and continues");

  // —— 3) 3아웃 + 결과 없음 → 공수 차단 (prediction_closed) ——
  await resetMatchIdle();
  await MatchModel.updateOne({ id: MATCH_ID }, { $set: { liveAutoEnabled: true } });
  await openPredictionViaAuto("타자갑");
  await stopRound(MATCH_ID);
  phase = await resolveAtBatPhase(MATCH_ID);
  await assert(phase === "prediction_closed", `expected closed, got ${phase}`);

  // seed baselines at 2 outs then hit 3 without suggested → blocked, stay closed
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
  await assert(afterBlock?.inningHalf === "top", "half must not advance without result");
  pass("3-out without result blocks switch");

  // —— 4) 3아웃 + suggested 아웃 → 자동 결과 후 공수 ——
  await resetMatchIdle({ half: "top", inning: 3, outs: 2 });
  await openPredictionViaAuto("타자을");
  await stopRound(MATCH_ID);
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
  await assert(
    phase === "idle" || phase === "result_confirmed",
    `after auto result+switch expect idle/result_confirmed, got ${phase}`,
  );
  // 같은 tick에서 공수 처리 후 return → 예측 재시작은 다음 폴링
  const mSwitch = await MatchModel.findOne({ id: MATCH_ID }).lean();
  await assert(
    !mSwitch?.predictionEnabled,
    "same tick after switch must not start prediction (ad/event window)",
  );
  const peekSwitch = peekLiveAutoAdResume(MATCH_ID);
  await assert(peekSwitch.resumeAfterAdBreak, "switch half should queue resume after ad");
  pass("3-out with suggested out: result then switch, no same-tick predict");

  // —— 5) 투수교체(예측 중) → skippedResult, 같은 tick 타자 예측 시작 안 함 ——
  await resetMatchIdle({ half: "top", inning: 4, outs: 0 });
  await openPredictionViaAuto("타자병", "투수구", { half: "top", inning: 4 });
  // 투수·타자 동시 변경 후보
  await processLiveAutoOperator(
    MATCH_ID,
    board({ batter: "새타자", pitcher: "신투수", outs: 1, half: "top", inning: 4 }),
  );
  await sleep(Math.max(LIVE_AUTO_BATTER_STABLE_MS, LIVE_AUTO_PITCHER_STABLE_MS) + 100);
  await processLiveAutoOperator(
    MATCH_ID,
    board({ batter: "새타자", pitcher: "신투수", outs: 1, half: "top", inning: 4 }),
  );
  phase = await resolveAtBatPhase(MATCH_ID);
  await assert(phase === "idle", `after pitcher change expect idle (defer batter), got ${phase}`);
  const mPitch = await MatchModel.findOne({ id: MATCH_ID }).select("predictionEnabled currentRound").lean();
  await assert(!mPitch?.predictionEnabled, "pitcher tick must not also reopen prediction");
  const peek = peekLiveAutoAdResume(MATCH_ID);
  await assert(peek.resumeAfterAdBreak, "pitcher change should queue same-batter resume");
  pass("pitcher change during open prediction refunds and defers batter");

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
    "cooldown must not re-advance pitcher change",
  );
  pass("duplicate pitcher change within cooldown is ignored");

  await assert(
    Boolean(broadcastManager.isAdBreakActive(MATCH_ID)),
    "ad intro/play should stay active after pitcher change",
  );
  await sleep(LIVE_AUTO_BATTER_STABLE_MS + 100);
  await processLiveAutoOperator(
    MATCH_ID,
    board({ batter: "광고중타자", pitcher: "신투수", outs: 1, half: "top", inning: 4 }),
  );
  await sleep(LIVE_AUTO_BATTER_STABLE_MS + 100);
  await processLiveAutoOperator(
    MATCH_ID,
    board({ batter: "광고중타자", pitcher: "신투수", outs: 1, half: "top", inning: 4 }),
  );
  phase = await resolveAtBatPhase(MATCH_ID);
  const duringAd = await MatchModel.findOne({ id: MATCH_ID }).select("predictionEnabled").lean();
  await assert(
    phase === "idle" && !duringAd?.predictionEnabled,
    `during ad break must not open prediction, got ${phase}`,
  );
  pass("batter change during ad break defers prediction");

  broadcastManager.stopAdPlaying(MATCH_ID, "operator_stop", "test ad complete");
  await sleep(250);
  phase = await resolveAtBatPhase(MATCH_ID);
  await assert(phase === "prediction_open", `after ad stop prediction should open, got ${phase}`);
  pass("ad stop resumes prediction automatically");

  // —— 6) 수동 결과 확정 경로와 호환 (결과 후 공수) ——
  await resetMatchIdle({ half: "top", inning: 5, outs: 2 });
  await openPredictionViaAuto("타자정", "박투수", { half: "top", inning: 5 });
  await stopRound(MATCH_ID);
  const round = (await MatchModel.findOne({ id: MATCH_ID }).select("currentRound").lean())?.currentRound ?? 1;
  await updateRoundPredictionResult(MATCH_ID, round, "아웃");
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
  await assert(phase === "idle", `after confirmed+switch expect idle, got ${phase}`);
  pass("manual result then auto switch");

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
