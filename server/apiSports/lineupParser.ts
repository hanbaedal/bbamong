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

function pickBattingFields(source: Record<string, unknown>): ParsedPlayerBattingStats {
  return {
    battingAverage: formatBattingAverage(
      (source.average ?? source.avg ?? source.battingAverage ?? source.AVG) as string | number | null,
    ),
    hits: extractInt(source.hits ?? source.h ?? source.totalHits ?? source.H),
    homeRuns: extractInt(
      source.homeRuns ??
        source.homeruns ??
        source.home_run ??
        source.home_runs ??
        source.hr ??
        source.HR,
    ),
    rbi: extractInt(source.rbi ?? source.runsBattedIn ?? source.RBI),
    ops: formatOps(
      (source.ops ?? source.onBasePlusSlugging ?? source.OPS ?? source.on_base_plus_slugging) as
        | string
        | number
        | null,
    ),
  };
}

function mergeBattingStats(
  current: ParsedPlayerBattingStats,
  next: ParsedPlayerBattingStats | null,
): ParsedPlayerBattingStats {
  if (!next) return current;
  return {
    battingAverage: current.battingAverage ?? next.battingAverage,
    hits: current.hits ?? next.hits,
    homeRuns: current.homeRuns ?? next.homeRuns,
    rbi: current.rbi ?? next.rbi,
    ops: current.ops ?? next.ops,
  };
}

function extractBattingFieldsFromBlock(block: Record<string, unknown>): ParsedPlayerBattingStats {
  const statsList = Array.isArray(block.statistics)
    ? block.statistics
    : Array.isArray(block.stats)
      ? block.stats
      : null;

  let merged: ParsedPlayerBattingStats = {
    battingAverage: null,
    hits: null,
    homeRuns: null,
    rbi: null,
    ops: null,
  };

  if (statsList) {
    for (const item of statsList) {
      const stat = asRecord(item);
      if (!stat) continue;
      const type = String(stat.type ?? stat.group ?? "").toLowerCase();
      if (type && !type.includes("bat") && type !== "hitting") continue;

      merged = mergeBattingStats(merged, pickBattingFields(stat));
      const nestedBatting = asRecord(stat.batting) ?? asRecord(stat.hitting);
      if (nestedBatting) merged = mergeBattingStats(merged, pickBattingFields(nestedBatting));
    }
  }

  const batting = asRecord(block.batting) ?? asRecord(block.hitting);
  if (batting) merged = mergeBattingStats(merged, pickBattingFields(batting));
  merged = mergeBattingStats(merged, pickBattingFields(block));

  return merged;
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

export interface ParsedRosterBatter {
  apiSportsPlayerId: number;
  name: string;
  positionRaw: string;
  battingAverage: string | null;
  hits: number | null;
  homeRuns: number | null;
  rbi: number | null;
  ops: string | null;
}

function extractPositionRaw(row: Record<string, unknown>): string {
  const player = asRecord(row.player);
  const statsList = Array.isArray(row.statistics)
    ? row.statistics
    : Array.isArray(row.stats)
      ? row.stats
      : [];
  const firstStat = asRecord(statsList[0]);
  const candidates = [
    row.position,
    row.pos,
    player?.position,
    player?.pos,
    asRecord(row.games)?.position,
    firstStat?.position,
    asRecord(firstStat?.games)?.position,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/** /players?team=&season= 응답 → 시즌 타자 명단 */
export function parseApiSportsTeamRoster(raw: unknown): ParsedRosterBatter[] {
  if (!raw) return [];
  const rows = Array.isArray(raw) ? raw : [raw];
  const byId = new Map<number, ParsedRosterBatter>();

  for (const item of rows) {
    const row = asRecord(item);
    if (!row) continue;
    const playerId = extractPlayerId(row);
    const name = extractPlayerName(row);
    if (!playerId || !name) continue;

    const stats = extractBattingFieldsFromBlock(row);
    const nested = asRecord(row.player);
    const nestedStats = nested ? extractBattingFieldsFromBlock(nested) : null;
    byId.set(playerId, {
      apiSportsPlayerId: playerId,
      name,
      positionRaw: extractPositionRaw(row),
      battingAverage: stats.battingAverage ?? nestedStats?.battingAverage ?? null,
      hits: stats.hits ?? nestedStats?.hits ?? null,
      homeRuns: stats.homeRuns ?? nestedStats?.homeRuns ?? null,
      rbi: stats.rbi ?? nestedStats?.rbi ?? null,
      ops: stats.ops ?? nestedStats?.ops ?? null,
    });
  }

  return Array.from(byId.values());
}
