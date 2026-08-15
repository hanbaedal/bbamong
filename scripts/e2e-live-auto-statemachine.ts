/**
 * 실황 자동 상태머신 통합 검증 — processLiveAutoOperator 전이/가드
 * npx tsx scripts/e2e-live-auto-statemachine.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import type { LiveScoreboard } from "../shared/apiSportsTypes";
import { MatchModel, RoundStatisticsModel } from "../server/UserStorage/db";
import { processLiveAutoOperator, clearLiveAutoOperator } from "../server/liveMatch/liveAutoOperator";
import { resolveAtBatPhase } from "../server/liveMatch/atBatStateMachine";

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

async function resetMatchIdle() {
  clearLiveAutoOperator(MATCH_ID);
  const match = await MatchModel.findOne({ id: MATCH_ID }).lean();
  if (!match) throw new Error("match missing");
  const round = (match.currentRound as number) ?? 1;
  await RoundStatisticsModel.updateOne(
    { matchId: MATCH_ID, roundNumber: round },
    {
      $set: {
        isPredictionStarted: false,
        isPredictionStopped: false,
        isResultSent: false,
        predictionStartTime: null,
        predictionStopTime: null,
      },
    },
    { upsert: false },
  );
  await MatchModel.updateOne(
    { id: MATCH_ID },
    {
      $set: {
        matchStatus: "ongoing",
        predictionEnabled: false,
        liveAutoEnabled: true,
        outsInHalf: 0,
        gameInning: 3,
        inningHalf: "top",
      },
    },
  );
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  await resetMatchIdle();

  // seed tick
  await processLiveAutoOperator(MATCH_ID, board({ batter: "김타자", pitcher: "박투수", outs: 0 }));
  let phase = await resolveAtBatPhase(MATCH_ID);
  await assert(phase === "idle", `seed should stay idle, got ${phase}`);

  // flicker: different names under 3s should NOT start
  await processLiveAutoOperator(MATCH_ID, board({ batter: "이타자", pitcher: "박투수", outs: 0 }));
  await sleep(500);
  await processLiveAutoOperator(MATCH_ID, board({ batter: "최타자", pitcher: "박투수", outs: 0 }));
  phase = await resolveAtBatPhase(MATCH_ID);
  await assert(phase === "idle", `flicker should not open prediction, got ${phase}`);

  // stable batter 3s+
  await processLiveAutoOperator(MATCH_ID, board({ batter: "안정타자", pitcher: "박투수", outs: 0 }));
  await sleep(3100);
  await processLiveAutoOperator(MATCH_ID, board({ batter: "안정타자", pitcher: "박투수", outs: 0 }));
  phase = await resolveAtBatPhase(MATCH_ID);
  await assert(phase === "prediction_open", `stable batter should open, got ${phase}`);

  // liveAuto OFF — reset and verify no action
  await resetMatchIdle();
  await MatchModel.updateOne({ id: MATCH_ID }, { $set: { liveAutoEnabled: false } });
  await processLiveAutoOperator(MATCH_ID, board({ batter: "김타자", pitcher: "박투수", outs: 0 }));
  await sleep(3100);
  await processLiveAutoOperator(MATCH_ID, board({ batter: "이타자", pitcher: "박투수", outs: 0 }));
  await sleep(3100);
  await processLiveAutoOperator(MATCH_ID, board({ batter: "이타자", pitcher: "박투수", outs: 0 }));
  phase = await resolveAtBatPhase(MATCH_ID);
  await assert(phase === "idle", `auto OFF must not start, got ${phase}`);
  const m = await MatchModel.findOne({ id: MATCH_ID }).select("predictionEnabled").lean();
  await assert(!m?.predictionEnabled, "predictionEnabled must stay false when auto OFF");

  // restore ON
  await MatchModel.updateOne({ id: MATCH_ID }, { $set: { liveAutoEnabled: true } });
  console.log("live-auto state machine E2E OK");
  await mongoose.disconnect();
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
