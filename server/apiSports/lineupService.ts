import type { CurrentBatterPreview, MatchLineupSnapshot, MatchPlayerStatsEntry } from "@shared/apiSportsTypes";
import { resolveCurrentBatterPreview } from "@shared/batterDisplay";
import { parseInningHalf, type InningHalf } from "@shared/gamePhaseTypes";
import { MatchModel } from "../UserStorage/db";
import { resolveApiSportsSeason } from "./constants";

type MatchLineupRow = {
  id: string;
  startTime?: Date;
  gameInning?: number | null;
  inningHalf?: string | null;
  batterIndexInHalf?: number | null;
  matchLineup?: MatchLineupSnapshot | null;
  matchPlayerStats?: Record<string, MatchPlayerStatsEntry> | null;
  pinchHitter?: import("@shared/apiSportsTypes").PinchHitterSnapshot | null;
  /** 실황 타자명 (liveScoreboard.situation.batterName) */
  liveBatterName?: string | null;
};

export function buildCurrentBatterPreviewFromMatch(
  match: MatchLineupRow,
  inningHalfOverride?: InningHalf | null,
): CurrentBatterPreview {
  const inningHalf = inningHalfOverride ?? parseInningHalf(match.inningHalf);
  const batterIndexInHalf = match.batterIndexInHalf ?? 1;
  const season = resolveApiSportsSeason(match.startTime);

  const statsForResolve: Record<
    string,
    {
      battingAverage?: string | null;
      hits?: number | null;
      homeRuns?: number | null;
      rbi?: number | null;
      ops?: string | null;
      runs?: number | null;
      stolenBases?: number | null;
      onBasePercentage?: string | null;
      position?: string | null;
      note?: string | null;
    }
  > = {};
  for (const [playerId, entry] of Object.entries(match.matchPlayerStats ?? {})) {
    statsForResolve[playerId] = {
      battingAverage: entry.battingAverage,
      hits: entry.hits ?? null,
      homeRuns: entry.homeRuns ?? null,
      rbi: entry.rbi ?? null,
      ops: entry.ops ?? null,
      runs: entry.runs ?? null,
      stolenBases: entry.stolenBases ?? null,
      onBasePercentage: entry.onBasePercentage ?? null,
      position: entry.position ?? null,
      note: entry.note ?? null,
    };
  }

  return resolveCurrentBatterPreview({
    lineup: match.matchLineup ?? null,
    inningHalf,
    batterIndexInHalf,
    playerStats: statsForResolve,
    season,
    pinchHitter: match.pinchHitter ?? null,
    liveBatterName: match.liveBatterName ?? null,
  });
}

export async function getCurrentBatterPreviewForMatch(
  matchId: string,
): Promise<CurrentBatterPreview | null> {
  const match = (await MatchModel.findOne({ id: matchId })
    .select(
      "id startTime gameInning inningHalf batterIndexInHalf matchLineup matchPlayerStats pinchHitter liveScoreboard",
    )
    .lean()) as (MatchLineupRow & {
    liveScoreboard?: { situation?: { batterName?: string | null } | null } | null;
  }) | null;

  if (!match) return null;
  return buildCurrentBatterPreviewFromMatch({
    ...match,
    liveBatterName: match.liveScoreboard?.situation?.batterName ?? null,
  });
}
