import { randomUUID } from "crypto";
import { formatBattingAverage, formatOps } from "@shared/batterDisplay";
import {
  assertKboTeamShort,
  isKboBatterPosition,
  type KboRosterPlayer,
} from "@shared/kboRoster";
import { resolveKboTeamShortName, isKboTeamShort, type KboTeamShort } from "@shared/kboHomeStadium";
import { KboPlayerModel } from "../mongodb/models";

export type KboPlayerWriteInput = {
  team: string;
  season: number;
  name: string;
  position: string;
  jerseyNumber?: string | null;
  batsThrows?: string | null;
  battingAverage?: string | number | null;
  hits?: number | null;
  homeRuns?: number | null;
  rbi?: number | null;
  ops?: string | number | null;
  note?: string | null;
  active?: boolean;
};

type LeanPlayer = {
  id: string;
  team: string;
  season: number;
  name: string;
  position?: string | null;
  jerseyNumber?: string | null;
  batsThrows?: string | null;
  battingAverage?: string | null;
  hits?: number | null;
  homeRuns?: number | null;
  rbi?: number | null;
  ops?: string | null;
  note?: string | null;
  active?: boolean;
  updatedAt?: Date | string;
  apiSportsPlayerId?: number | null;
};

function currentSeason(): number {
  return new Date().getFullYear();
}

function normalizeSeason(season?: number): number {
  if (typeof season === "number" && Number.isFinite(season) && season >= 2000 && season <= 2100) {
    return Math.round(season);
  }
  return currentSeason();
}

function normalizeHits(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(999, Math.round(value)));
}

function toPublic(doc: LeanPlayer): KboRosterPlayer {
  return {
    id: doc.id,
    team: doc.team,
    season: doc.season,
    name: doc.name,
    position: doc.position?.trim() || "",
    jerseyNumber: (doc.jerseyNumber ?? "").trim(),
    batsThrows: (doc.batsThrows ?? "").trim(),
    battingAverage: formatBattingAverage(doc.battingAverage ?? null),
    hits: normalizeHits(doc.hits ?? null),
    homeRuns: normalizeHits(doc.homeRuns ?? null),
    rbi: normalizeHits(doc.rbi ?? null),
    ops: formatOps(doc.ops ?? null),
    note: doc.note?.trim() || "",
    active: doc.active !== false,
    apiSportsPlayerId: typeof doc.apiSportsPlayerId === "number" ? doc.apiSportsPlayerId : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
  };
}

function normalizeWrite(input: KboPlayerWriteInput) {
  const team = assertKboTeamShort(input.team);
  const name = input.name.trim();
  if (!name) throw new Error("선수 이름을 입력하세요.");
  if (name.length > 40) throw new Error("선수 이름은 40자 이하여야 합니다.");
  const position = input.position.trim();
  if (!position) throw new Error("포지션을 선택하세요.");
  if (!isKboBatterPosition(position)) throw new Error("올바른 포지션이 아닙니다.");
  const note = (input.note ?? "").trim();
  if (note.length > 80) throw new Error("특징은 80자 이하여야 합니다.");
  const jerseyNumber = (input.jerseyNumber ?? "").trim();
  if (jerseyNumber.length > 4) throw new Error("등번호는 4자 이하여야 합니다.");
  const batsThrows = (input.batsThrows ?? "").trim();
  if (batsThrows.length > 20) throw new Error("투타유형은 20자 이하여야 합니다.");
  return {
    team,
    season: normalizeSeason(input.season),
    name,
    position,
    jerseyNumber,
    batsThrows,
    battingAverage: formatBattingAverage(input.battingAverage ?? null),
    hits: normalizeHits(input.hits ?? null),
    homeRuns: normalizeHits(input.homeRuns ?? null),
    rbi: normalizeHits(input.rbi ?? null),
    ops: formatOps(input.ops ?? null),
    note,
    active: input.active !== false,
  };
}

function duplicateError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: number }).code === 11000,
  );
}

export async function listKboPlayers(input: {
  team: string;
  season?: number;
  activeOnly?: boolean;
}): Promise<KboRosterPlayer[]> {
  const team = assertKboTeamShort(input.team);
  const season = normalizeSeason(input.season);
  const filter: Record<string, unknown> = { team, season };
  if (input.activeOnly) filter.active = true;
  const rows = await KboPlayerModel.find(filter).lean();
  const positionRank = new Map(
    ["투수", "포수", "내야수", "외야수", "1루수", "2루수", "3루수", "유격수", "좌익수", "중견수", "우익수", "지명타자"].map(
      (pos, i) => [pos, i],
    ),
  );
  return (rows as LeanPlayer[])
    .map(toPublic)
    .sort((a, b) => {
      const pa = positionRank.get(a.position) ?? 99;
      const pb = positionRank.get(b.position) ?? 99;
      if (pa !== pb) return pa - pb;
      const ja = Number.parseInt(a.jerseyNumber, 10);
      const jb = Number.parseInt(b.jerseyNumber, 10);
      if (Number.isFinite(ja) && Number.isFinite(jb) && ja !== jb) return ja - jb;
      return a.name.localeCompare(b.name, "ko");
    });
}

export async function getKboPlayersByIds(ids: string[]): Promise<KboRosterPlayer[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return [];
  const rows = await KboPlayerModel.find({ id: { $in: unique } }).lean();
  return (rows as LeanPlayer[]).map(toPublic);
}

export async function createKboPlayer(input: KboPlayerWriteInput): Promise<KboRosterPlayer> {
  const data = normalizeWrite(input);
  try {
    const created = await KboPlayerModel.create({
      id: randomUUID(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return toPublic(created.toObject() as LeanPlayer);
  } catch (error) {
    if (duplicateError(error)) {
      throw new Error("같은 시즌·팀에 이미 등록된 이름입니다.");
    }
    throw error;
  }
}

export async function updateKboPlayer(
  id: string,
  input: KboPlayerWriteInput,
): Promise<KboRosterPlayer> {
  const data = normalizeWrite(input);
  try {
    const updated = await KboPlayerModel.findOneAndUpdate(
      { id },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true },
    ).lean();
    if (!updated) throw new Error("선수를 찾을 수 없습니다.");
    return toPublic(updated as LeanPlayer);
  } catch (error) {
    if (duplicateError(error)) {
      throw new Error("같은 시즌·팀에 이미 등록된 이름입니다.");
    }
    throw error;
  }
}

export async function deleteKboPlayer(id: string): Promise<void> {
  const result = await KboPlayerModel.deleteOne({ id });
  if (result.deletedCount === 0) throw new Error("선수를 찾을 수 없습니다.");
}

export function resolveMatchTeamShort(
  match: {
    apiSportsHomeTeam?: string | null;
    apiSportsAwayTeam?: string | null;
    liveScoreboard?: { homeTeamName?: string | null; awayTeamName?: string | null } | null;
  },
  side: "home" | "away",
): KboTeamShort | null {
  const raw =
    side === "home"
      ? match.apiSportsHomeTeam || match.liveScoreboard?.homeTeamName
      : match.apiSportsAwayTeam || match.liveScoreboard?.awayTeamName;
  const short = resolveKboTeamShortName(raw);
  return short && isKboTeamShort(short) ? short : null;
}
