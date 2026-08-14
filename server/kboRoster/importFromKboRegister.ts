import { randomUUID } from "crypto";
import { assertKboTeamShort } from "@shared/kboRoster";
import { KBO_TEAM_SHORT_LIST, type KboTeamShort } from "@shared/kboHomeStadium";
import { KboPlayerModel } from "../mongodb/models";
import { fetchKboRegisterRosters, type KboRegisterPlayer } from "./kboRegisterClient";

export type KboRosterImportScope = "team" | "all";

export type KboRosterImportTeamResult = {
  team: string;
  created: number;
  updated: number;
  deactivated: number;
  fetched: number;
  error?: string;
};

function currentSeason(): number {
  return new Date().getFullYear();
}

async function upsertRegisterPlayer(input: {
  team: KboTeamShort;
  season: number;
  player: KboRegisterPlayer;
}): Promise<"created" | "updated"> {
  const { team, season, player } = input;
  const existing = await KboPlayerModel.findOne({ team, season, name: player.name }).lean();
  const $set = {
    position: player.position,
    jerseyNumber: player.jerseyNumber,
    batsThrows: player.batsThrows,
    active: true,
    updatedAt: new Date(),
  };

  if (existing) {
    await KboPlayerModel.updateOne({ id: existing.id }, { $set });
    return "updated";
  }

  await KboPlayerModel.create({
    id: randomUUID(),
    team,
    season,
    name: player.name,
    position: player.position,
    jerseyNumber: player.jerseyNumber,
    batsThrows: player.batsThrows,
    battingAverage: null,
    hits: null,
    homeRuns: null,
    rbi: null,
    ops: null,
    note: "",
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return "created";
}

async function importOneTeam(
  team: KboTeamShort,
  season: number,
  players: KboRegisterPlayer[],
): Promise<KboRosterImportTeamResult> {
  let created = 0;
  let updated = 0;
  const names: string[] = [];

  for (const player of players) {
    names.push(player.name);
    const result = await upsertRegisterPlayer({ team, season, player });
    if (result === "created") created += 1;
    else updated += 1;
  }

  let deactivated = 0;
  if (names.length > 0) {
    const deactivate = await KboPlayerModel.updateMany(
      {
        team,
        season,
        name: { $nin: names },
        active: true,
      },
      { $set: { active: false, updatedAt: new Date() } },
    );
    deactivated = deactivate.modifiedCount ?? 0;
  }

  return { team, created, updated, deactivated, fetched: players.length };
}

export async function importKboRosterFromRegister(input: {
  season?: number;
  team?: string;
  scope: KboRosterImportScope;
}): Promise<{
  season: number;
  teams: KboRosterImportTeamResult[];
}> {
  const season =
    typeof input.season === "number" && Number.isFinite(input.season)
      ? Math.round(input.season)
      : currentSeason();
  const targets: KboTeamShort[] =
    input.scope === "all"
      ? ([...KBO_TEAM_SHORT_LIST] as KboTeamShort[])
      : [assertKboTeamShort(input.team ?? "")];

  const { rosters, errors } = await fetchKboRegisterRosters(targets);
  const teams: KboRosterImportTeamResult[] = [];
  for (const team of targets) {
    const players = rosters.get(team) ?? [];
    const fetchError = errors.get(team);
    try {
      if (players.length === 0) {
        teams.push({
          team,
          created: 0,
          updated: 0,
          deactivated: 0,
          fetched: 0,
          error: fetchError || "1군 등록 선수를 읽지 못했습니다.",
        });
        continue;
      }
      teams.push(await importOneTeam(team, season, players));
    } catch (error) {
      teams.push({
        team,
        created: 0,
        updated: 0,
        deactivated: 0,
        fetched: players.length,
        error: error instanceof Error ? error.message : "저장에 실패했습니다.",
      });
    }
  }
  return { season, teams };
}
