import { MatchModel, StadiumModel } from "./db";
import type { Match, InsertMatch } from "@shared/schema";
import { getKstDateString } from "../utils/dateUtils";
import { getApiSyncEnabledBySlot } from "../managerOperatorService";
import { resolveMatchTeamNames, type MatchHeadToHeadRecord, type MatchTeamNameInput } from "@shared/matchTeamDisplay";
import { refreshMatchHeadToHeadIfDue } from "../apiSports/h2hService";
import type { MatchHeadToHeadSnapshot } from "@shared/apiSportsTypes";

function extractMatchNumber(name: string): number {
  const match = name.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function resolveRegistrationOrder(match: Match & { registrationOrder?: number | null }): number {
  const order = match.registrationOrder;
  if (order != null && order >= 1) return order;
  return extractMatchNumber(match.name);
}

function todayMatchDateFilter() {
  const kstToday = getKstDateString();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    kstToday,
    filter: {
      $or: [
        { matchDate: kstToday },
        { matchDate: null, startTime: { $gte: today, $lt: tomorrow } },
      ],
    },
  };
}

export type ClientMatchView = Match & {
  stadiumName: string;
  awayTeamName: string;
  homeTeamName: string;
  headToHead: MatchHeadToHeadRecord | null;
  registrationOrder: number;
  sideBetEnabled: boolean;
  sideBetsLocked: boolean;
};

async function enrichForClient(
  match: Match & {
    stadiumName: string;
    registrationOrder?: number | null;
    sideBetsLocked?: boolean;
    matchHeadToHead?: MatchHeadToHeadSnapshot | null;
  },
  syncBySlot: Map<number, boolean>,
): Promise<ClientMatchView> {
  const registrationOrder = resolveRegistrationOrder(match);
  const sideBetEnabled = syncBySlot.get(registrationOrder) ?? false;
  const { awayTeamName, homeTeamName } = resolveMatchTeamNames({
    apiSportsAwayTeam: match.apiSportsAwayTeam,
    apiSportsHomeTeam: match.apiSportsHomeTeam,
    liveScoreboard: match.liveScoreboard as MatchTeamNameInput["liveScoreboard"],
  });
  const headToHead = match.matchHeadToHead
    ? { awayWins: match.matchHeadToHead.awayWins, homeWins: match.matchHeadToHead.homeWins }
    : null;
  return {
    ...match,
    awayTeamName,
    homeTeamName,
    headToHead,
    registrationOrder,
    sideBetEnabled,
    sideBetsLocked: Boolean(match.sideBetsLocked),
  };
}

async function enrichWithStadiumName(
  match: Match & { stadiumName?: string },
): Promise<Match & { stadiumName: string }> {
  const stadium = await StadiumModel.findOne({ id: match.stadiumId }).select("name").lean();
  return { ...match, stadiumName: stadium?.name || "Unknown Stadium" };
}

export class MatchStorage {
  /** 오늘 전체 (종료·연기 포함 — 경기 선택 슬롯·side bet 결과 표시용) */
  async getTodayMatchesForClient(): Promise<ClientMatchView[]> {
    const { filter } = todayMatchDateFilter();

    const docs = await MatchModel.find({
      ...filter,
    }).lean();

    const matches = (docs as Match[]).sort((a, b) => {
      const orderA = resolveRegistrationOrder(a);
      const orderB = resolveRegistrationOrder(b);
      if (orderA !== orderB) return orderA - orderB;
      return extractMatchNumber(a.name) - extractMatchNumber(b.name);
    });

    const syncBySlot = await getApiSyncEnabledBySlot();
    const enriched = await Promise.all(matches.map((m) => enrichWithStadiumName(m)));

    const withHeadToHead = await Promise.all(
      enriched.map(async (m) => {
        const row = m as Match & { matchHeadToHead?: MatchHeadToHeadSnapshot | null };
        if (!row.apiSportsAwayTeamId || !row.apiSportsHomeTeamId) return row;
        const snapshot = await refreshMatchHeadToHeadIfDue(row.id, {
          id: row.id,
          startTime: row.startTime,
          apiSportsAwayTeamId: row.apiSportsAwayTeamId,
          apiSportsHomeTeamId: row.apiSportsHomeTeamId,
          matchHeadToHead: row.matchHeadToHead ?? null,
        });
        return snapshot ? { ...row, matchHeadToHead: snapshot } : row;
      }),
    );

    return Promise.all(withHeadToHead.map((m) => enrichForClient(m, syncBySlot)));
  }

  async getTodayActiveMatches(): Promise<Array<Match & { stadiumName: string }>> {
    const { filter } = todayMatchDateFilter();

    const docs = await MatchModel.find({
      matchStatus: { $nin: ["completed", "cancelled"] },
      ...filter,
    }).lean();

    const matches = (docs as Match[]).sort(
      (a, b) => extractMatchNumber(a.name) - extractMatchNumber(b.name),
    );

    return Promise.all(matches.map((m) => enrichWithStadiumName(m)));
  }

  async getMatchWithStadium(
    id?: number,
  ): Promise<Array<Match & { stadiumName: string }> | (Match & { stadiumName: string }) | undefined> {
    if (id !== undefined) {
      const doc = await MatchModel.findOne({ id: String(id) }).lean();
      if (!doc) return undefined;
      return enrichWithStadiumName(doc as Match);
    }

    const docs = await MatchModel.find().lean();
    return Promise.all((docs as Match[]).map((m) => enrichWithStadiumName(m)));
  }

  async getMatchById(id: string): Promise<(Match & { stadiumName: string }) | undefined> {
    const doc = await MatchModel.findOne({ id }).lean();
    if (!doc) return undefined;
    return enrichWithStadiumName(doc as Match);
  }

  async getMatch(id: number): Promise<Match | undefined> {
    const doc = await MatchModel.findOne({ id: String(id) }).lean();
    return doc ? (doc as Match) : undefined;
  }

  async getStadium(id: number) {
    const doc = await StadiumModel.findOne({ id }).lean();
    return doc || undefined;
  }

  async createMatch(match: InsertMatch): Promise<Match> {
    const doc = await MatchModel.create(match);
    return doc.toObject() as Match;
  }

  async updateMatch(id: number, match: Partial<InsertMatch>): Promise<Match | undefined> {
    const doc = await MatchModel.findOneAndUpdate({ id: String(id) }, match, { new: true }).lean();
    return doc ? (doc as Match) : undefined;
  }

  async deleteMatch(id: number): Promise<void> {
    await MatchModel.deleteOne({ id: String(id) });
  }
}

export const matchStorage = new MatchStorage();
