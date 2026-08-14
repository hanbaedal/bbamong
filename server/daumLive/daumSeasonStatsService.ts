import { formatEra, formatSeasonRate } from "@shared/batterDisplay";
import { resolveKboTeamShortName } from "@shared/kboHomeStadium";
import type {
  MatchLineupSnapshot,
  MatchPlayerStatsEntry,
  MatchTeamSeasonStats,
  TeamSeasonStats,
} from "@shared/apiSportsTypes";
import { MatchModel } from "../UserStorage/db";
import { resolveApiSportsSeason } from "../apiSports/constants";
import { resolveMatchTeamShort } from "../kboRoster/kboRosterService";
import {
  fetchDaumPersonBattingRank,
  fetchDaumTeamRank,
  type DaumPersonBattingRow,
  type DaumTeamRankRow,
} from "./daumHermesClient";

const SEASON_STATS_REFRESH_MS = 30 * 60_000;
const PLAYER_STATS_REFRESH_MS = 30 * 60_000;

function compactName(name: string): string {
  return name.replace(/\s+/g, "").replace(/[·･•]/g, "").trim();
}

function battingKey(name: string, teamShort: string): string {
  return `${compactName(name)}|${teamShort}`;
}

function toInt(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
}

export function parseDaumTeamSeasonStats(
  row: DaumTeamRankRow | undefined,
  season: number,
  teamShort: string,
): TeamSeasonStats | null {
  if (!row) return null;
  const rank = row.rank;
  return {
    teamShort,
    season,
    rank: toInt(rank?.rank),
    wins: toInt(rank?.win),
    draws: toInt(rank?.draw),
    losses: toInt(rank?.loss),
    winningPercentage: formatSeasonRate(rank?.wpct ?? null),
    battingAverage: formatSeasonRate(row.stat?.batAvg ?? null),
    era: formatEra(row.stat?.pitEra ?? null),
    gamesBehind: rank?.gb != null && String(rank.gb).trim() ? String(rank.gb).trim() : null,
  };
}

export function parseDaumPersonBattingStats(
  row: DaumPersonBattingRow,
  syncedAt: string,
): MatchPlayerStatsEntry {
  const stat = row.stat ?? {};
  return {
    battingAverage: formatSeasonRate(stat.batAvg ?? null),
    hits: toInt(stat.batH),
    homeRuns: toInt(stat.batHr),
    rbi: toInt(stat.batRbi),
    ops: formatSeasonRate(stat.batOps ?? null),
    runs: toInt(stat.batR),
    stolenBases: toInt(stat.batSb),
    onBasePercentage: formatSeasonRate(stat.batObp ?? null),
    syncedAt,
  };
}

export async function buildTeamSeasonStatsMap(season: number): Promise<Map<string, TeamSeasonStats>> {
  const list = await fetchDaumTeamRank(season);
  const map = new Map<string, TeamSeasonStats>();
  for (const row of list) {
    const short = resolveKboTeamShortName(row.shortNameKo || row.shortName || row.nameKo);
    if (!short) continue;
    const parsed = parseDaumTeamSeasonStats(row, season, short);
    if (parsed) map.set(short, parsed);
  }
  return map;
}

export async function buildPersonBattingStatsMap(
  season: number,
): Promise<Map<string, MatchPlayerStatsEntry>> {
  const list = await fetchDaumPersonBattingRank(season);
  const syncedAt = new Date().toISOString();
  const map = new Map<string, MatchPlayerStatsEntry>();
  for (const row of list) {
    const name = compactName(row.nameKo || row.name || "");
    const team = resolveKboTeamShortName(row.team?.shortNameKo || row.team?.shortName || row.team?.nameKo);
    if (!name || !team) continue;
    const key = battingKey(name, team);
    if (!map.has(key)) {
      map.set(key, parseDaumPersonBattingStats(row, syncedAt));
    }
  }
  return map;
}

type MatchForSeason = {
  id: string;
  startTime?: Date | null;
  apiSportsHomeTeam?: string | null;
  apiSportsAwayTeam?: string | null;
  liveScoreboard?: { homeTeamName?: string | null; awayTeamName?: string | null } | null;
  matchLineup?: MatchLineupSnapshot | null;
  matchPlayerStats?: Record<string, MatchPlayerStatsEntry> | null;
  matchTeamSeasonStats?: MatchTeamSeasonStats | null;
};

function seasonStatsStale(snapshot?: MatchTeamSeasonStats | null): boolean {
  if (!snapshot?.syncedAt) return true;
  return Date.now() - new Date(snapshot.syncedAt).getTime() >= SEASON_STATS_REFRESH_MS;
}

function playerStatsNeedDaumRefresh(stats?: Record<string, MatchPlayerStatsEntry> | null): boolean {
  const entries = Object.values(stats ?? {});
  if (entries.length === 0) return true;
  const missingExtended = entries.some(
    (entry) => entry.runs == null && entry.stolenBases == null && entry.onBasePercentage == null,
  );
  if (missingExtended) return true;
  const newest = entries
    .map((entry) => new Date(entry.syncedAt).getTime())
    .filter((ms) => Number.isFinite(ms))
    .sort((a, b) => b - a)[0];
  if (!newest) return true;
  return Date.now() - newest >= PLAYER_STATS_REFRESH_MS;
}

export async function refreshMatchSeasonContext(
  matchId: string,
  options?: { force?: boolean },
): Promise<MatchTeamSeasonStats | null> {
  const match = (await MatchModel.findOne({ id: matchId })
    .select(
      "id startTime apiSportsHomeTeam apiSportsAwayTeam liveScoreboard matchLineup matchPlayerStats matchTeamSeasonStats",
    )
    .lean()) as MatchForSeason | null;
  if (!match) return null;

  const season = resolveApiSportsSeason(match.startTime ?? undefined);
  const homeShort = resolveMatchTeamShort(match, "home");
  const awayShort = resolveMatchTeamShort(match, "away");
  const force = options?.force === true;
  const needTeam = force || seasonStatsStale(match.matchTeamSeasonStats);
  const needPlayers = force || playerStatsNeedDaumRefresh(match.matchPlayerStats);

  const update: Record<string, unknown> = {};
  let teamSnapshot = match.matchTeamSeasonStats ?? null;

  if (needTeam && (homeShort || awayShort)) {
    const teamMap = await buildTeamSeasonStatsMap(season);
    teamSnapshot = {
      season,
      home: homeShort ? teamMap.get(homeShort) ?? null : null,
      away: awayShort ? teamMap.get(awayShort) ?? null : null,
      syncedAt: new Date().toISOString(),
    };
    update.matchTeamSeasonStats = teamSnapshot;
  }

  if (needPlayers && match.matchLineup) {
    const battingMap = await buildPersonBattingStatsMap(season);
    const prev = { ...(match.matchPlayerStats ?? {}) };
    const syncedAt = new Date().toISOString();
    const applySide = (side: "home" | "away", teamShort: string | null) => {
      if (!teamShort) return;
      const batters = side === "home" ? match.matchLineup?.home ?? [] : match.matchLineup?.away ?? [];
      for (const batter of batters) {
        const daum = battingMap.get(battingKey(batter.name, teamShort));
        if (!daum) continue;
        const key = String(batter.playerId);
        prev[key] = {
          ...(prev[key] ?? {}),
          ...daum,
          position: prev[key]?.position ?? null,
          note: prev[key]?.note ?? null,
          syncedAt,
        };
      }
    };
    applySide("home", homeShort);
    applySide("away", awayShort);
    update.matchPlayerStats = prev;
  }

  if (Object.keys(update).length > 0) {
    await MatchModel.updateOne({ id: matchId }, update);
  }

  return teamSnapshot;
}

export async function lookupDaumBatterStats(input: {
  name: string;
  teamShort?: string | null;
  season: number;
}): Promise<MatchPlayerStatsEntry | null> {
  const name = compactName(input.name);
  const team = resolveKboTeamShortName(input.teamShort);
  if (!name || !team) return null;
  const map = await buildPersonBattingStatsMap(input.season);
  return map.get(battingKey(name, team)) ?? null;
}
