import { randomUUID } from "crypto";
import {
  mongoose,
  MatchModel,
  StadiumModel,
  PredictionModel,
  RoundStatisticsModel,
  AdminUserModel,
  UserModel,
  getNextSequence,
} from "../UserStorage/db";
import type { Match, InsertMatch } from "@shared/schema";
import { getKstDateString } from "../utils/dateUtils";

export class MatchConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MatchConflictError";
  }
}

export interface IAdminMatchStorage {
  getAllMatches(): Promise<Match[]>;
  getTodayMatches(): Promise<Array<Match & { stadium: { id: number; name: string } }>>;
  getTodayMatchesByManager(managerId: string): Promise<Array<Match & { stadium: { id: number; name: string } }>>;
  getMatchById(id: string): Promise<(Match & { stadium: { id: number; name: string } }) | undefined>;
  getMatchByIdForManager(
    id: string,
    managerId: string,
  ): Promise<
    | (Match & {
        stadium: { id: number; name: string };
        predictionStartTime?: Date | null;
        predictionStopTime?: Date | null;
      })
    | undefined
  >;
  getMatchesByDate(date: Date | string): Promise<Match[]>;
  createMatch(match: InsertMatch): Promise<Match>;
  createMatchBatch(matches: InsertMatch[], targetDate: string): Promise<Match[]>;
  updateMatch(id: string, match: InsertMatch): Promise<Match | undefined>;
  deleteMatch(id: string): Promise<void>;
}

function buildTodayFilter(kstToday: string, today: Date, tomorrow: Date) {
  return {
    $or: [
      { matchDate: kstToday },
      { matchDate: null, startTime: { $gte: today, $lt: tomorrow } },
    ],
  };
}

async function attachStadium(match: Match): Promise<Match & { stadium: { id: number; name: string } }> {
  const stadium = await StadiumModel.findOne({ id: match.stadiumId }).select("id name").lean();
  return {
    ...match,
    stadium: { id: stadium?.id ?? match.stadiumId, name: stadium?.name ?? "" },
  };
}

export class AdminMatchStorage implements IAdminMatchStorage {
  async getAllMatches(): Promise<Match[]> {
    const docs = await MatchModel.find().sort({ startTime: -1 }).lean();
    return docs as Match[];
  }

  async getTodayMatches(): Promise<Array<Match & { stadium: { id: number; name: string } }>> {
    const kstToday = getKstDateString();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const docs = await MatchModel.find(buildTodayFilter(kstToday, today, tomorrow))
      .sort({ startTime: 1 })
      .lean();
    return Promise.all((docs as Match[]).map(attachStadium));
  }

  async getTodayMatchesByManager(managerId: string) {
    const kstToday = getKstDateString();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const manager = await AdminUserModel.findOne({ id: managerId })
      .select("assignedMatchNumber")
      .lean();
    if (!manager?.assignedMatchNumber) return [];

    const docs = await MatchModel.find({
      name: manager.assignedMatchNumber,
      ...buildTodayFilter(kstToday, today, tomorrow),
    })
      .sort({ startTime: 1 })
      .lean();

    return Promise.all((docs as Match[]).map(attachStadium));
  }

  async getMatchById(id: string) {
    const doc = await MatchModel.findOne({ id }).lean();
    if (!doc) return undefined;
    return attachStadium(doc as Match);
  }

  async getMatchByIdForManager(id: string, managerId: string) {
    const manager = await AdminUserModel.findOne({ id: managerId })
      .select("assignedMatchNumber")
      .lean();
    if (!manager?.assignedMatchNumber) return undefined;

    const match = await MatchModel.findOne({
      id,
      name: manager.assignedMatchNumber,
    }).lean();
    if (!match) return undefined;

    const [stadium, roundStats] = await Promise.all([
      StadiumModel.findOne({ id: match.stadiumId }).select("id name").lean(),
      RoundStatisticsModel.findOne({
        matchId: match.id,
        roundNumber: match.currentRound,
      })
        .select("predictionStartTime predictionStopTime")
        .lean(),
    ]);

    return {
      ...(match as Match),
      predictionStartTime: roundStats?.predictionStartTime ?? null,
      predictionStopTime: roundStats?.predictionStopTime ?? null,
      stadium: { id: stadium?.id ?? match.stadiumId, name: stadium?.name ?? "" },
    };
  }

  async getMatchesByDate(date: Date | string): Promise<Match[]> {
    const kstDateString = typeof date === "string" ? date : getKstDateString(date);
    const dateObj = typeof date === "string" ? new Date(`${date}T12:00:00`) : date;
    const startOfDay = new Date(dateObj);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);

    const docs = await MatchModel.find({
      $or: [
        { matchDate: kstDateString },
        { matchDate: null, startTime: { $gte: startOfDay, $lte: endOfDay } },
      ],
    }).lean();
    return docs as Match[];
  }

  async createMatch(match: InsertMatch): Promise<Match> {
    const id = match.id || randomUUID();
    const kstToday = (match as InsertMatch & { matchDate?: string }).matchDate ?? getKstDateString();
    const dateObj = new Date(`${kstToday}T12:00:00`);
    const startOfDay = new Date(dateObj);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);
    const existingCount = await MatchModel.countDocuments({
      $or: [
        { matchDate: kstToday },
        { matchDate: null, startTime: { $gte: startOfDay, $lte: endOfDay } },
      ],
    });
    const doc = await MatchModel.create({
      ...match,
      id,
      registrationOrder: existingCount + 1,
    });
    return doc.toObject() as Match;
  }

  async createMatchBatch(matchList: InsertMatch[], targetDate: string): Promise<Match[]> {
    if (matchList.length === 0) return [];

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const dateObj = new Date(`${targetDate}T12:00:00`);
      const startOfDay = new Date(dateObj);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateObj);
      endOfDay.setHours(23, 59, 59, 999);

      const existingMatches = await MatchModel.find({
        $or: [
          { matchDate: targetDate },
          { matchDate: null, startTime: { $gte: startOfDay, $lte: endOfDay } },
        ],
      })
        .session(session)
        .lean();

      const existing = existingMatches as Match[];
      const existingById = new Map(existing.map((m) => [m.id, m]));
      const existingByName = new Map(existing.map((m) => [m.name, m]));
      const processedExistingIds = new Set<string>();

      const toUpdate: Array<{ id: string; data: InsertMatch }> = [];
      const toInsert: InsertMatch[] = [];
      const toDelete: Match[] = [];

      for (const newMatch of matchList) {
        if (
          !newMatch.name ||
          !newMatch.stadiumId ||
          !newMatch.startTime ||
          !newMatch.endTime ||
          !newMatch.matchStatus
        ) {
          throw new MatchConflictError(
            "경기 정보가 불완전합니다. 모든 필수 필드를 입력해주세요.",
          );
        }

        if (newMatch.id) {
          const found = existingById.get(newMatch.id);
          if (found) {
            toUpdate.push({ id: found.id, data: newMatch });
            processedExistingIds.add(found.id);
          } else {
            throw new MatchConflictError(
              `경기 ID ${newMatch.id}를 찾을 수 없습니다. 다른 관리자가 삭제했을 수 있습니다.`,
            );
          }
        } else {
          const found = existingByName.get(newMatch.name);
          if (found) {
            throw new MatchConflictError(
              `'${newMatch.name}'는 이미 존재합니다. 수정하려면 기존 경기 데이터를 불러와주세요.`,
            );
          }
          toInsert.push(newMatch);
        }
      }

      for (const ex of existing) {
        if (!processedExistingIds.has(ex.id)) {
          toDelete.push(ex);
        }
      }

      const submittedStadiumIds = matchList.map((m) => m.stadiumId);
      if (submittedStadiumIds.length !== new Set(submittedStadiumIds).size) {
        throw new MatchConflictError("같은 날짜에 같은 경기구장을 중복 사용할 수 없습니다.");
      }
      if (matchList.length > 5) {
        throw new MatchConflictError("한 날짜에 최대 5경기까지만 등록할 수 있습니다.");
      }

      if (toDelete.length > 0) {
        const deleteIds = toDelete.map((m) => m.id);
        const predictionCounts = await PredictionModel.aggregate<{ matchId: string; count: number }>([
          { $match: { matchId: { $in: deleteIds } } },
          { $group: { _id: "$matchId", count: { $sum: 1 } } },
          { $project: { matchId: "$_id", count: 1, _id: 0 } },
        ]).session(session);

        if (predictionCounts.length > 0) {
          const conflictMatches = toDelete
            .filter((m) => predictionCounts.some((pc) => pc.matchId === m.id))
            .map((m) => m.name);
          throw new MatchConflictError(
            `다음 경기들에 예측 데이터가 있어 삭제할 수 없습니다: ${conflictMatches.join(", ")}. 경기를 유지하거나 예측 데이터를 먼저 삭제해주세요.`,
          );
        }
      }

      for (const { id, data } of toUpdate) {
        const prev = existingById.get(id);
        if (prev?.matchStatus === "completed") {
          const timeChanged =
            prev.startTime.getTime() !== new Date(data.startTime).getTime() ||
            prev.endTime.getTime() !== new Date(data.endTime).getTime();

          if (timeChanged) {
            await MatchModel.updateOne(
              { id },
              { ...data, matchStatus: "scheduled", currentRound: 1, predictionEnabled: false },
              { session },
            );
          } else {
            await MatchModel.updateOne(
              { id },
              { ...data, matchStatus: "completed", predictionEnabled: false },
              { session },
            );
          }
        } else {
          await MatchModel.updateOne({ id }, data, { session });
        }
      }

      for (const match of toDelete) {
        await MatchModel.deleteOne({ id: match.id }, { session });
      }

      for (const insertData of toInsert) {
        const { id: _omit, ...rest } = insertData as InsertMatch & { id?: string };
        const newId = randomUUID();
        const orderIndex = matchList.findIndex(
          (m) => !m.id && m.name === insertData.name && m.stadiumId === insertData.stadiumId,
        );
        await MatchModel.create(
          [{ ...rest, id: newId, registrationOrder: orderIndex >= 0 ? orderIndex + 1 : matchList.length }],
          { session },
        );
      }

      for (let i = 0; i < matchList.length; i++) {
        const item = matchList[i]!;
        let targetId = item.id;
        if (!targetId) {
          const found = existingByName.get(item.name);
          targetId = found?.id;
        }
        if (targetId) {
          await MatchModel.updateOne({ id: targetId }, { registrationOrder: i + 1 }, { session });
        }
      }

      const finalMatches = await MatchModel.find({
        $or: [
          { matchDate: targetDate },
          { matchDate: null, startTime: { $gte: startOfDay, $lte: endOfDay } },
        ],
      })
        .session(session)
        .lean();

      await session.commitTransaction();
      return finalMatches as Match[];
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async updateMatch(id: string, match: InsertMatch): Promise<Match | undefined> {
    const doc = await MatchModel.findOneAndUpdate({ id }, match, { new: true }).lean();
    return doc ? (doc as Match) : undefined;
  }

  async deleteMatch(id: string): Promise<void> {
    await MatchModel.deleteOne({ id });
  }

  async updateMatchPredictionEnabled(id: string, enabled: boolean): Promise<void> {
    const match = await MatchModel.findOne({ id }).lean();
    if (!match) return;

    await MatchModel.updateOne({ id }, { predictionEnabled: enabled });

    const existingStats = await RoundStatisticsModel.findOne({
      matchId: id,
      roundNumber: match.currentRound,
    }).lean();

    const now = new Date();

    if (existingStats) {
      await RoundStatisticsModel.updateOne(
        { id: existingStats.id },
        enabled ? { predictionStartTime: now } : { predictionStopTime: now },
      );
    } else {
      const statsId = await getNextSequence("roundStatistics");
      await RoundStatisticsModel.create({
        id: statsId,
        matchId: id,
        roundNumber: match.currentRound,
        totalParticipants: 0,
        totalPoints: 0,
        totalWinners: 0,
        predictionStartTime: enabled ? now : null,
        predictionStopTime: enabled ? null : now,
      });
    }
  }

  async updateRoundResult(matchId: string, roundNumber: number, result: string): Promise<void> {
    const roundPredictions = await PredictionModel.find({ matchId, roundNumber }).lean();

    for (const prediction of roundPredictions) {
      const status = prediction.prediction === result ? "success" : "fail";
      await PredictionModel.updateOne({ id: prediction.id }, { result, status });
    }

    const successfulPredictions = await PredictionModel.find({
      matchId,
      roundNumber,
      status: "success",
    }).lean();

    for (const prediction of successfulPredictions) {
      const reward = prediction.amount * 2;
      await UserModel.findOneAndUpdate({ id: prediction.userId }, { $inc: { points: reward } });
    }
  }
}

export const adminMatchStorage = new AdminMatchStorage();
