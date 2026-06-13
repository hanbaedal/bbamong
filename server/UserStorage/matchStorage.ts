import { MatchModel, StadiumModel } from "./db";
import type { Match, InsertMatch } from "@shared/schema";
import { getKstDateString } from "../utils/dateUtils";

function extractMatchNumber(name: string): number {
  const match = name.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

async function enrichWithStadiumName(
  match: Match & { stadiumName?: string },
): Promise<Match & { stadiumName: string }> {
  const stadium = await StadiumModel.findOne({ id: match.stadiumId }).select("name").lean();
  return { ...match, stadiumName: stadium?.name || "Unknown Stadium" };
}

export class MatchStorage {
  async getTodayActiveMatches(): Promise<Array<Match & { stadiumName: string }>> {
    const kstToday = getKstDateString();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const docs = await MatchModel.find({
      matchStatus: { $nin: ["completed", "cancelled"] },
      $or: [
        { matchDate: kstToday },
        {
          matchDate: null,
          startTime: { $gte: today, $lt: tomorrow },
        },
      ],
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
