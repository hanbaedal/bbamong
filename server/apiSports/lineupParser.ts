import type { LineupBatterEntry, MatchLineupSnapshot } from "@shared/apiSportsTypes";
import { formatBattingAverage, formatOps } from "@shared/batterDisplay";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function extractPlayerId(row: Record<string, unknown>): number | null {
  const player = asRecord(row.player) ?? asRecord(row.players);
  const id = row.playerId ?? row.id ?? player?.id;
  const num = typeof id === "number" ? id : Number.parseInt(String(id ?? ""), 10);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function extractPlayerName(row: Record<string, unknown>): string {
  if (typeof row.name === "string" && row.name.trim()) return row.name.trim();
  if (typeof row.player === "string" && row.player.trim()) return row.player.trim();

  const player = asRecord(row.player);
  if (player) {
    if (typeof player.name === "string" && player.name.trim()) return player.name.trim();
    const first = player.firstname ?? player.firstName;
    const last = player.lastname ?? player.lastName;
    const combined = `${first ?? ""} ${last ?? ""}`.trim();
    if (combined) return combined;
  }
  return "";
}

function extractBattingOrder(row: Record<string, unknown>, fallbackIndex: number): number {
  const raw = row.battingOrder ?? row.order ?? row.number ?? row.lineup ?? row.pos ?? row.position;
  const num = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (Number.isFinite(num) && num >= 1 && num <= 9) return num;
  return fallbackIndex + 1;
}

function pushBatter(target: LineupBatterEntry[], row: Record<string, unknown>, index: number): void {
  const playerId = extractPlayerId(row);
  const name = extractPlayerName(row);
  if (!playerId || !name) return;
  const battingOrder = extractBattingOrder(row, index);
  if (target.some((p) => p.playerId === playerId)) return;
  target.push({ playerId, name, battingOrder });
}

function parseLineupArray(rows: unknown[]): LineupBatterEntry[] {
  const batters: LineupBatterEntry[] = [];
  rows.forEach((item, index) => {
    const row = asRecord(item);
    if (!row) return;
    pushBatter(batters, row, index);
  });
  return batters.sort((a, b) => a.battingOrder - b.battingOrder);
}

function parseSideFromTeamBlock(block: Record<string, unknown>): LineupBatterEntry[] {
  const candidates =
    (Array.isArray(block.lineups) && block.lineups) ||
    (Array.isArray(block.lineup) && block.lineup) ||
    (Array.isArray(block.players) && block.players) ||
    (Array.isArray(block.starting) && block.starting) ||
    [];
  return parseLineupArray(candidates);
}

function parseLineupSideEntry(entry: Record<string, unknown>): {
  home: LineupBatterEntry[];
  away: LineupBatterEntry[];
} {
  const homeBlock = asRecord(entry.home) ?? asRecord(entry.homeTeam);
  const awayBlock = asRecord(entry.away) ?? asRecord(entry.awayTeam);

  if (homeBlock || awayBlock) {
    return {
      home: homeBlock ? parseSideFromTeamBlock(homeBlock) : [],
      away: awayBlock ? parseSideFromTeamBlock(awayBlock) : [],
    };
  }

  const team = asRecord(entry.team);
  const sideRows =
    (Array.isArray(entry.lineups) && entry.lineups) ||
    (Array.isArray(entry.lineup) && entry.lineup) ||
    (Array.isArray(entry.players) && entry.players) ||
    [];

  const batters = parseLineupArray(sideRows);
  const teamName = team?.name != null ? String(team.name).toLowerCase() : "";
  const isHome =
    entry.type === "home" ||
    entry.side === "home" ||
    teamName.includes("home") ||
    entry.home === true;

  const isAway =
    entry.type === "away" ||
    entry.side === "away" ||
    teamName.includes("away") ||
    entry.away === true;

  if (isHome && !isAway) return { home: batters, away: [] };
  if (isAway && !isHome) return { home: [], away: batters };

  return { home: [], away: batters };
}

/** API lineups/statistics 응답 → home/away 타순 */
export function parseLineupSnapshot(raw: unknown): MatchLineupSnapshot | null {
  if (!raw) return null;

  const home: LineupBatterEntry[] = [];
  const away: LineupBatterEntry[] = [];

  const merge = (parsed: { home: LineupBatterEntry[]; away: LineupBatterEntry[] }) => {
    for (const p of parsed.home) {
      if (!home.some((x) => x.playerId === p.playerId)) home.push(p);
    }
    for (const p of parsed.away) {
      if (!away.some((x) => x.playerId === p.playerId)) away.push(p);
    }
  };

  if (Array.isArray(raw)) {
    for (const item of raw) {
      const entry = asRecord(item);
      if (!entry) continue;
      merge(parseLineupSideEntry(entry));
    }
  } else {
    const root = asRecord(raw);
    if (!root) return null;
    merge(parseLineupSideEntry(root));
  }

  if (home.length === 0 && away.length === 0) return null;

  return {
    syncedAt: new Date().toISOString(),
    home: home.sort((a, b) => a.battingOrder - b.battingOrder),
    away: away.sort((a, b) => a.battingOrder - b.battingOrder),
  };
}

function extractInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface ParsedPlayerBattingStats {
  battingAverage: string | null;
  hits: number | null;
  homeRuns: number | null;
  rbi: number | null;
  ops: string | null;
}

function extractBattingFieldsFromBlock(block: Record<string, unknown>): ParsedPlayerBattingStats {
  const statsList = Array.isArray(block.statistics)
    ? block.statistics
    : Array.isArray(block.stats)
      ? block.stats
      : null;

  let avg: string | null = null;
  let hits: number | null = null;
  let homeRuns: number | null = null;
  let rbi: number | null = null;
  let ops: string | null = null;

  if (statsList) {
    for (const item of statsList) {
      const stat = asRecord(item);
      if (!stat) continue;
      const type = String(stat.type ?? stat.group ?? "").toLowerCase();
      if (type && !type.includes("bat") && type !== "hitting") continue;

      avg =
        avg ??
        formatBattingAverage(
          (stat.average ?? stat.avg ?? stat.battingAverage ?? stat.AVG) as string | number | null,
        );
      hits = hits ?? extractInt(stat.hits ?? stat.h ?? stat.totalHits ?? stat.H);
      homeRuns =
        homeRuns ?? extractInt(stat.homeRuns ?? stat.home_run ?? stat.home_runs ?? stat.hr ?? stat.HR);
      rbi = rbi ?? extractInt(stat.rbi ?? stat.runsBattedIn ?? stat.RBI);
      ops =
        ops ??
        formatOps(
          (stat.ops ?? stat.onBasePlusSlugging ?? stat.OPS ?? stat.on_base_plus_slugging) as
            | string
            | number
            | null,
        );
    }
  }

  const batting = asRecord(block.batting) ?? asRecord(block.hitting);
  if (batting) {
    avg =
      avg ??
      formatBattingAverage(
        (batting.average ?? batting.avg ?? batting.battingAverage) as string | number | null,
      );
    hits = hits ?? extractInt(batting.hits ?? batting.h ?? batting.totalHits);
    homeRuns =
      homeRuns ?? extractInt(batting.homeRuns ?? batting.home_run ?? batting.home_runs ?? batting.hr);
    rbi = rbi ?? extractInt(batting.rbi ?? batting.runsBattedIn);
    ops = ops ?? formatOps((batting.ops ?? batting.onBasePlusSlugging) as string | number | null);
  }

  avg =
    avg ??
    formatBattingAverage(
      (block.average ?? block.avg ?? block.battingAverage) as string | number | null,
    );
  hits = hits ?? extractInt(block.hits ?? block.h ?? block.totalHits);
  homeRuns =
    homeRuns ?? extractInt(block.homeRuns ?? block.home_run ?? block.home_runs ?? block.hr);
  rbi = rbi ?? extractInt(block.rbi ?? block.runsBattedIn);
  ops = ops ?? formatOps((block.ops ?? block.onBasePlusSlugging) as string | number | null);

  return { battingAverage: avg, hits, homeRuns, rbi, ops };
}

function extractAverageFromStatsBlock(block: Record<string, unknown>): string | null {
  return extractBattingFieldsFromBlock(block).battingAverage;
}

/** players / players/statistics / games/statistics 응답에서 playerId → 시즌 타격 기록 */
export function parsePlayerBattingStats(raw: unknown): Map<number, ParsedPlayerBattingStats> {
  const map = new Map<number, ParsedPlayerBattingStats>();
  if (!raw) return map;

  const rows = Array.isArray(raw) ? raw : [raw];
  for (const item of rows) {
    const row = asRecord(item);
    if (!row) continue;

    const playerId = extractPlayerId(row);
    if (!playerId) continue;

    map.set(playerId, extractBattingFieldsFromBlock(row));
  }

  return map;
}

/** players / players/statistics / games/statistics 응답에서 playerId → 타율 */
export function parsePlayerBattingAverages(raw: unknown): Map<number, string | null> {
  const map = new Map<number, string | null>();
  if (!raw) return map;

  const rows = Array.isArray(raw) ? raw : [raw];
  for (const item of rows) {
    const row = asRecord(item);
    if (!row) continue;

    const playerId = extractPlayerId(row);
    if (!playerId) continue;

    const avg = extractAverageFromStatsBlock(row);
    if (avg) map.set(playerId, avg);
  }

  return map;
}

export function collectLineupPlayerIds(lineup: MatchLineupSnapshot): number[] {
  const ids = new Set<number>();
  for (const p of [...lineup.home, ...lineup.away]) ids.add(p.playerId);
  return Array.from(ids);
}
