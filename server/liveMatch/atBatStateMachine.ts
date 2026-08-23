import {
  atBatPhaseLabel,
  deriveAtBatPhase,
  type AtBatPhase,
} from "@shared/atBatPhase";
import { RoundStatisticsModel, MatchModel } from "../UserStorage/db";
import { broadcastManager } from "./broadcastManager";

export type { AtBatPhase };

export async function resolveAtBatPhase(matchId: string): Promise<AtBatPhase> {
  const match = await MatchModel.findOne({ id: matchId })
    .select("currentRound predictionEnabled")
    .lean();
  if (!match) return "idle";
  const stats = await RoundStatisticsModel.findOne({
    matchId,
    roundNumber: match.currentRound ?? 1,
  })
    .select("isPredictionStarted isPredictionStopped isResultSent")
    .lean();
  return deriveAtBatPhase({
    predictionEnabled: match.predictionEnabled,
    isPredictionStarted: stats?.isPredictionStarted,
    isPredictionStopped: stats?.isPredictionStopped,
    isResultSent: stats?.isResultSent,
  });
}

export async function broadcastAtBatPhase(
  matchId: string,
  phase?: AtBatPhase,
  extra?: Record<string, unknown>,
): Promise<AtBatPhase> {
  const resolved = phase ?? (await resolveAtBatPhase(matchId));
  const match = await MatchModel.findOne({ id: matchId }).select("currentRound").lean();
  broadcastManager.sendToMatch(matchId, "at_bat_phase", {
    matchId,
    phase: resolved,
    phaseLabel: atBatPhaseLabel(resolved),
    currentRound: match?.currentRound ?? 1,
    ...extra,
  });
  return resolved;
}

/** 수동 버튼 직후 — DB 기준으로 단계 재동기화 */
export async function syncAtBatPhaseAfterManual(
  matchId: string,
  source: string,
): Promise<AtBatPhase> {
  return broadcastAtBatPhase(matchId, undefined, { source });
}
