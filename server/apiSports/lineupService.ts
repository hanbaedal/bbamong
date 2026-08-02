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
  parsePlayerBattingStats,
  type ParsedPlayerBattingStats,
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

function toMatchPlayerStatsEntry(stats: ParsedPlayerBattingStats, syncedAt: string): MatchPlayerStatsEntry {
  return {
    battingAverage: stats.battingAverage,
    hits: stats.hits,
    homeRuns: stats.homeRuns,
    rbi: stats.rbi,
    ops: stats.ops,
    syncedAt,
  };
}

function statsEntryIsFresh(entry: MatchPlayerStatsEntry | undefined): boolean {
  if (!entry?.syncedAt) return false;
  const age = Date.now() - new Date(entry.syncedAt).getTime();
  if (age >= 6 * 60 * 60 * 1000) return false;
  return entry.battingAverage != null || entry.hits != null;
}

async function fetchSeasonStatsForPlayer(
  playerId: number,
  season: number,
  teamIds: number[],
): Promise<MatchPlayerStatsEntry> {
  const cached = memoryPlayerStats.get(statsKey(playerId, season));
  if (cached) return cached;

  const empty = (syncedAt: string): MatchPlayerStatsEntry => ({
    battingAverage: null,
    hits: null,
    homeRuns: null,
    rbi: null,
    ops: null,
    syncedAt,
  });

  const direct = await fetchPlayerStatistics(playerId, season, KBO_LEAGUE_ID);
  const fromDirect = parsePlayerBattingStats(direct).get(playerId);
  if (fromDirect) {
    const entry = toMatchPlayerStatsEntry(fromDirect, new Date().toISOString());
    memoryPlayerStats.set(statsKey(playerId, season), entry);
    return entry;
  }

  for (const teamId of teamIds) {
    const roster = await fetchTeamPlayers(teamId, season);
    const fromRoster = parsePlayerBattingStats(roster).get(playerId);
    if (fromRoster) {
      const entry = toMatchPlayerStatsEntry(fromRoster, new Date().toISOString());
      memoryPlayerStats.set(statsKey(playerId, season), entry);
      return entry;
    }
  }

  const entry = empty(new Date().toISOString());
  memoryPlayerStats.set(statsKey(playerId, season), entry);
  return entry;
}

async function enrichPlayerStatsForLineup(
  lineup: MatchLineupSnapshot,
  existing: Record<string, MatchPlayerStatsEntry> | null | undefined,
  season: number,
  teamIds: number[],
): Promise<Record<string, MatchPlayerStatsEntry>> {
  const next: Record<string, MatchPlayerStatsEntry> = { ...(existing ?? {}) };
  const playerIds = collectLineupPlayerIds(lineup);

  for (const playerId of playerIds) {
    const key = String(playerId);
    const prev = next[key];
    if (statsEntryIsFresh(prev)) continue;

    const stats = await fetchSeasonStatsForPlayer(playerId, season, teamIds);
    next[key] = stats;
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

  const statsForResolve: Record<
    string,
    {
      battingAverage?: string | null;
      hits?: number | null;
      homeRuns?: number | null;
      rbi?: number | null;
      ops?: string | null;
    }
  > = {};
  for (const [playerId, entry] of Object.entries(match.matchPlayerStats ?? {})) {
    statsForResolve[playerId] = {
      battingAverage: entry.battingAverage,
      hits: entry.hits ?? null,
      homeRuns: entry.homeRuns ?? null,
      rbi: entry.rbi ?? null,
      ops: entry.ops ?? null,
    };
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
