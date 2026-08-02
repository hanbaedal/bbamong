import type { CurrentBatterPreview, MatchLineupSnapshot, MatchPlayerStatsEntry } from "@shared/apiSportsTypes";
import { resolveCurrentBatterPreview } from "@shared/batterDisplay";
import { parseInningHalf, type InningHalf } from "@shared/gamePhaseTypes";
import { MatchModel } from "../UserStorage/db";
import {
  fetchGameLineups,
  fetchGameStatistics,
  fetchPlayerStatistics,
  fetchTeamPlayers,
} from "./client";
import { KBO_LEAGUE_ID, LINEUP_REFRESH_MS, resolveApiSportsSeason } from "./constants";
import {
  collectLineupPlayerIds,
  parseLineupSnapshot,
  parsePlayerBattingAverages,
} from "./lineupParser";

type MatchLineupRow = {
  id: string;
  apiSportsGameId?: number | null;
  startTime?: Date;
  gameInning?: number | null;
  inningHalf?: string | null;
  batterIndexInHalf?: number | null;
  matchLineup?: MatchLineupSnapshot | null;
  matchPlayerStats?: Record<string, MatchPlayerStatsEntry> | null;
};

const memoryPlayerStats = new Map<string, MatchPlayerStatsEntry>();

function lineupIsStale(snapshot?: MatchLineupSnapshot | null): boolean {
  if (!snapshot?.syncedAt) return true;
  const age = Date.now() - new Date(snapshot.syncedAt).getTime();
  return age >= LINEUP_REFRESH_MS;
}

function statsKey(playerId: number, season: number): string {
  return `${playerId}:${season}`;
}

async function fetchLineupSnapshot(gameId: number): Promise<MatchLineupSnapshot | null> {
  const lineupsRaw = await fetchGameLineups(gameId);
  const fromLineups = parseLineupSnapshot(lineupsRaw);
  if (fromLineups) return fromLineups;

  const statsRaw = await fetchGameStatistics(gameId);
  return parseLineupSnapshot(statsRaw);
}

async function fetchSeasonAverageForPlayer(
  playerId: number,
  season: number,
  teamIds: number[],
): Promise<string | null> {
  const cached = memoryPlayerStats.get(statsKey(playerId, season));
  if (cached) return cached.battingAverage;

  const direct = await fetchPlayerStatistics(playerId, season, KBO_LEAGUE_ID);
  const fromDirect = parsePlayerBattingAverages(direct).get(playerId);
  if (fromDirect) {
    memoryPlayerStats.set(statsKey(playerId, season), {
      battingAverage: fromDirect,
      syncedAt: new Date().toISOString(),
    });
    return fromDirect;
  }

  for (const teamId of teamIds) {
    const roster = await fetchTeamPlayers(teamId, season);
    const fromRoster = parsePlayerBattingAverages(roster).get(playerId);
    if (fromRoster) {
      memoryPlayerStats.set(statsKey(playerId, season), {
        battingAverage: fromRoster,
        syncedAt: new Date().toISOString(),
      });
      return fromRoster;
    }
  }

  memoryPlayerStats.set(statsKey(playerId, season), {
    battingAverage: null,
    syncedAt: new Date().toISOString(),
  });
  return null;
}

async function enrichPlayerStatsForLineup(
  lineup: MatchLineupSnapshot,
  existing: Record<string, MatchPlayerStatsEntry> | null | undefined,
  season: number,
  teamIds: number[],
): Promise<Record<string, MatchPlayerStatsEntry>> {
  const next: Record<string, MatchPlayerStatsEntry> = { ...(existing ?? {}) };
  const playerIds = collectLineupPlayerIds(lineup);
  const now = new Date().toISOString();

  for (const playerId of playerIds) {
    const key = String(playerId);
    const prev = next[key];
    if (prev?.battingAverage && prev.syncedAt) {
      const age = Date.now() - new Date(prev.syncedAt).getTime();
      if (age < 6 * 60 * 60 * 1000) continue;
    }

    const avg = await fetchSeasonAverageForPlayer(playerId, season, teamIds);
    next[key] = { battingAverage: avg, syncedAt: now };
  }

  return next;
}

/** live sync / 경기 시작 시 라인업·시즌 타율 갱신 (due일 때만 API 호출) */
export async function refreshMatchLineupIfDue(
  matchId: string,
  prefetched?: MatchLineupRow | null,
  teamIds: number[] = [],
): Promise<void> {
  if (!process.env.API_SPORTS_KEY?.trim()) return;

  const match =
    prefetched ??
    ((await MatchModel.findOne({ id: matchId })
      .select(
        "id apiSportsGameId startTime gameInning inningHalf batterIndexInHalf matchLineup matchPlayerStats",
      )
      .lean()) as MatchLineupRow | null);

  if (!match?.apiSportsGameId) return;
  if (!lineupIsStale(match.matchLineup)) return;

  const game = await fetchLineupSnapshot(match.apiSportsGameId);
  if (!game) return;

  const season = resolveApiSportsSeason(match.startTime);
  const stats = await enrichPlayerStatsForLineup(game, match.matchPlayerStats, season, teamIds);

  await MatchModel.updateOne(
    { id: matchId },
    {
      matchLineup: game,
      matchPlayerStats: stats,
    },
  );
}

export function buildCurrentBatterPreviewFromMatch(
  match: MatchLineupRow,
  inningHalfOverride?: InningHalf | null,
): CurrentBatterPreview {
  const inningHalf = inningHalfOverride ?? parseInningHalf(match.inningHalf);
  const batterIndexInHalf = match.batterIndexInHalf ?? 1;
  const season = resolveApiSportsSeason(match.startTime);

  const statsForResolve: Record<string, { battingAverage?: string | null }> = {};
  for (const [playerId, entry] of Object.entries(match.matchPlayerStats ?? {})) {
    statsForResolve[playerId] = { battingAverage: entry.battingAverage };
  }

  return resolveCurrentBatterPreview({
    lineup: match.matchLineup ?? null,
    inningHalf,
    batterIndexInHalf,
    playerStats: statsForResolve,
    season,
  });
}

export async function getCurrentBatterPreviewForMatch(
  matchId: string,
): Promise<CurrentBatterPreview | null> {
  const match = (await MatchModel.findOne({ id: matchId })
    .select(
      "id apiSportsGameId startTime gameInning inningHalf batterIndexInHalf matchLineup matchPlayerStats",
    )
    .lean()) as MatchLineupRow | null;

  if (!match) return null;
  return buildCurrentBatterPreviewFromMatch(match);
}
