import { randomUUID } from "crypto";
import { assertKboTeamShort, mapApiPositionToKbo } from "@shared/kboRoster";
import { KBO_TEAM_SHORT_LIST, resolveKboTeamShortName, type KboTeamShort } from "@shared/kboHomeStadium";
import { formatBattingAverage, formatOps } from "@shared/batterDisplay";
import { fetchLeagueTeams, fetchTeamPlayersAllPages } from "../apiSports/client";
import { KBO_LEAGUE_ID, resolveApiSportsSeason } from "../apiSports/constants";
import { parseApiSportsTeamRoster } from "../apiSports/lineupParser";
import {
  ApiSportsScheduleCacheModel,
  KboPlayerModel,
  MatchModel,
} from "../mongodb/models";

export type KboRosterImportScope = "team" | "all";

export type KboRosterImportTeamResult = {
  team: string;
  teamId: number | null;
  created: number;
  updated: number;
  deactivated: number;
  skippedPitchers: number;
  fetched: number;
  error?: string;
};

async function resolveTeamIds(season: number): Promise<Map<KboTeamShort, number>> {
  const map = new Map<KboTeamShort, number>();

  const cacheRows = await ApiSportsScheduleCacheModel.find({
    $or: [{ season }, { date: { $regex: `^${season}-` } }],
  })
    .select("homeTeamId homeTeamName awayTeamId awayTeamName")
    .lean();
  for (const row of cacheRows) {
    const homeShort = resolveKboTeamShortName(row.homeTeamName);
    const awayShort = resolveKboTeamShortName(row.awayTeamName);
    if (homeShort && row.homeTeamId) map.set(homeShort, row.homeTeamId);
    if (awayShort && row.awayTeamId) map.set(awayShort, row.awayTeamId);
  }

  if (map.size < KBO_TEAM_SHORT_LIST.length) {
    const start = new Date(`${season}-01-01T00:00:00.000Z`);
    const end = new Date(`${season + 1}-01-01T00:00:00.000Z`);
    const matches = await MatchModel.find({
      startTime: { $gte: start, $lt: end },
      $or: [{ apiSportsHomeTeamId: { $ne: null } }, { apiSportsAwayTeamId: { $ne: null } }],
    })
      .select("apiSportsHomeTeam apiSportsHomeTeamId apiSportsAwayTeam apiSportsAwayTeamId")
      .lean();
    for (const match of matches) {
      const homeShort = resolveKboTeamShortName(match.apiSportsHomeTeam);
      const awayShort = resolveKboTeamShortName(match.apiSportsAwayTeam);
      if (homeShort && match.apiSportsHomeTeamId) map.set(homeShort, match.apiSportsHomeTeamId);
      if (awayShort && match.apiSportsAwayTeamId) map.set(awayShort, match.apiSportsAwayTeamId);
    }
  }

  if (map.size < KBO_TEAM_SHORT_LIST.length) {
    const apiTeams = await fetchLeagueTeams(KBO_LEAGUE_ID, season);
    for (const team of apiTeams) {
      const short = resolveKboTeamShortName(team.name);
      if (short && !map.has(short)) map.set(short, team.id);
    }
  }

  return map;
}

async function upsertImportedPlayer(input: {
  team: KboTeamShort;
  season: number;
  apiSportsPlayerId: number;
  name: string;
  position: string;
  battingAverage: string | null;
  hits: number | null;
  homeRuns: number | null;
  rbi: number | null;
  ops: string | null;
}): Promise<"created" | "updated"> {
  const stats = {
    battingAverage: formatBattingAverage(input.battingAverage),
    hits: input.hits,
    homeRuns: input.homeRuns,
    rbi: input.rbi,
    ops: formatOps(input.ops),
    active: true,
    apiSportsPlayerId: input.apiSportsPlayerId,
    updatedAt: new Date(),
  };

  const byApiId = await KboPlayerModel.findOne({
    season: input.season,
    apiSportsPlayerId: input.apiSportsPlayerId,
  }).lean();
  if (byApiId) {
    const $set: Record<string, unknown> = { ...stats, team: input.team };
    if (!String(byApiId.position ?? "").trim()) $set.position = input.position;
    await KboPlayerModel.updateOne({ id: byApiId.id }, { $set });
    return "updated";
  }

  const byName = await KboPlayerModel.findOne({
    team: input.team,
    season: input.season,
    name: input.name,
  }).lean();
  if (byName) {
    const $set: Record<string, unknown> = { ...stats };
    if (!String(byName.position ?? "").trim()) $set.position = input.position;
    await KboPlayerModel.updateOne({ id: byName.id }, { $set });
    return "updated";
  }

  await KboPlayerModel.create({
    id: randomUUID(),
    team: input.team,
    season: input.season,
    name: input.name.slice(0, 40),
    position: input.position,
    note: "",
    createdAt: new Date(),
    ...stats,
  });
  return "created";
}

async function importOneTeam(
  team: KboTeamShort,
  season: number,
  teamIds: Map<KboTeamShort, number>,
): Promise<KboRosterImportTeamResult> {
  const teamId = teamIds.get(team) ?? null;
  if (!teamId) {
    return {
      team,
      teamId: null,
      created: 0,
      updated: 0,
      deactivated: 0,
      skippedPitchers: 0,
      fetched: 0,
      error: "API 팀 ID를 찾지 못했습니다. 경기 일정을 한 번 불러온 뒤 다시 시도하세요.",
    };
  }

  const raw = await fetchTeamPlayersAllPages(teamId, season);
  if (!raw) {
    return {
      team,
      teamId,
      created: 0,
      updated: 0,
      deactivated: 0,
      skippedPitchers: 0,
      fetched: 0,
      error: "API-SPORTS 선수 목록을 가져오지 못했습니다.",
    };
  }

  const parsed = parseApiSportsTeamRoster(raw);
  let created = 0;
  let updated = 0;
  let skippedPitchers = 0;
  const importedIds: number[] = [];

  for (const batter of parsed) {
    const position = mapApiPositionToKbo(batter.positionRaw);
    if (position === "투수") {
      skippedPitchers += 1;
      continue;
    }
    importedIds.push(batter.apiSportsPlayerId);
    const result = await upsertImportedPlayer({
      team,
      season,
      apiSportsPlayerId: batter.apiSportsPlayerId,
      name: batter.name,
      position,
      battingAverage: batter.battingAverage,
      hits: batter.hits,
      homeRuns: batter.homeRuns,
      rbi: batter.rbi,
      ops: batter.ops,
    });
    if (result === "created") created += 1;
    else updated += 1;
  }

  let deactivated = 0;
  if (importedIds.length > 0) {
    const deactivate = await KboPlayerModel.updateMany(
      {
        team,
        season,
        apiSportsPlayerId: { $nin: importedIds, $ne: null },
        active: true,
      },
      { $set: { active: false, updatedAt: new Date() } },
    );
    deactivated = deactivate.modifiedCount ?? 0;
  }

  return {
    team,
    teamId,
    created,
    updated,
    deactivated,
    skippedPitchers,
    fetched: parsed.length,
  };
}

export async function importKboRosterFromApiSports(input: {
  season?: number;
  team?: string;
  scope: KboRosterImportScope;
}): Promise<{
  season: number;
  teams: KboRosterImportTeamResult[];
}> {
  if (!process.env.API_SPORTS_KEY?.trim()) {
    throw new Error("API_SPORTS_KEY가 설정되지 않았습니다.");
  }

  const season = Number.isFinite(input.season) && input.season
    ? input.season
    : resolveApiSportsSeason();
  const teamIds = await resolveTeamIds(season);
  const targets: KboTeamShort[] =
    input.scope === "all"
      ? (KBO_TEAM_SHORT_LIST as KboTeamShort[])
      : [assertKboTeamShort(input.team ?? "")];

  const teams: KboRosterImportTeamResult[] = [];
  for (const team of targets) {
    teams.push(await importOneTeam(team, season, teamIds));
  }
  return { season, teams };
}
