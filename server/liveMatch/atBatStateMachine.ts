import {
  atBatPhaseLabel,
  deriveAtBatPhase,
  type AtBatPhase,
} from "@shared/atBatPhase";
import {
  atBatPhaseToUiStage,
  type PredictionUiStagePayload,
} from "@shared/predictionUiStage";
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
    .select("isPredictionStarted isPredictionStopped isResultSent settledResult")
    .lean();
  return deriveAtBatPhase({
    predictionEnabled: match.predictionEnabled,
    isPredictionStarted: stats?.isPredictionStarted,
    isPredictionStopped: stats?.isPredictionStopped,
    isResultSent: stats?.isResultSent,
  });
}

/** 클라 권위 페이로드 — WS at_bat_phase / HTTP match 상세 공통 */
export async function buildPredictionUiStagePayload(
  matchId: string,
  phase?: AtBatPhase,
  extra?: Record<string, unknown>,
): Promise<PredictionUiStagePayload> {
  const match = await MatchModel.findOne({ id: matchId })
    .select("currentRound predictionEnabled")
    .lean();
  const currentRound = match?.currentRound ?? 1;
  const stats = await RoundStatisticsModel.findOne({ matchId, roundNumber: currentRound })
    .select("isPredictionStarted isPredictionStopped isResultSent settledResult")
    .lean();
  const resolved =
    phase ??
    deriveAtBatPhase({
      predictionEnabled: match?.predictionEnabled,
      isPredictionStarted: stats?.isPredictionStarted,
      isPredictionStopped: stats?.isPredictionStopped,
      isResultSent: stats?.isResultSent,
    });
  const rawSettled = (stats as { settledResult?: string | null } | null)?.settledResult;
  const settled =
    typeof rawSettled === "string" && rawSettled.trim() ? rawSettled.trim() : null;
  return {
    matchId,
    stage: atBatPhaseToUiStage(resolved),
    atBatPhase: resolved,
    currentRound,
    settledResult: resolved === "result_confirmed" ? settled : null,
    ...(extra?.source ? { source: String(extra.source) } : {}),
  };
}

export async function broadcastAtBatPhase(
  matchId: string,
  phase?: AtBatPhase,
  extra?: Record<string, unknown>,
): Promise<AtBatPhase> {
  const payload = await buildPredictionUiStagePayload(matchId, phase, extra);
  broadcastManager.sendToMatch(matchId, "at_bat_phase", {
    ...payload,
    phase: payload.atBatPhase,
    phaseLabel: atBatPhaseLabel(payload.atBatPhase),
    uiStage: payload.stage,
    ...extra,
  });
  return payload.atBatPhase;
}

/** 수동 버튼 직후 — DB 기준으로 단계 재동기화 */
export async function syncAtBatPhaseAfterManual(
  matchId: string,
  source: string,
): Promise<AtBatPhase> {
  return broadcastAtBatPhase(matchId, undefined, { source });
}
