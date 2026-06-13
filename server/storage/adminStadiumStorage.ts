import {
  mongoose,
  StadiumModel,
  MatchModel,
  PredictionModel,
  RoundStatisticsModel,
  getNextSequence,
} from "../UserStorage/db";
import type { Stadium, InsertStadium } from "@shared/schema";

export interface IAdminStadiumStorage {
  getAllStadiums(): Promise<Stadium[]>;
  createStadium(stadium: InsertStadium): Promise<Stadium>;
  updateStadium(id: number, stadium: InsertStadium): Promise<Stadium | undefined>;
  deleteStadium(id: number): Promise<void>;
}

export class AdminStadiumStorage implements IAdminStadiumStorage {
  async getAllStadiums(): Promise<Stadium[]> {
    const docs = await StadiumModel.find().sort({ createdAt: -1 }).lean();
    return docs as Stadium[];
  }

  async createStadium(stadium: InsertStadium): Promise<Stadium> {
    const id = await getNextSequence("stadium");
    const doc = await StadiumModel.create({ id, ...stadium });
    return doc.toObject() as Stadium;
  }

  async updateStadium(id: number, stadium: InsertStadium): Promise<Stadium | undefined> {
    const doc = await StadiumModel.findOneAndUpdate({ id }, stadium, { new: true }).lean();
    return doc ? (doc as Stadium) : undefined;
  }

  async getMatchCountByStadium(id: number): Promise<number> {
    return MatchModel.countDocuments({ stadiumId: id });
  }

  async deleteStadium(id: number): Promise<void> {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const relatedMatches = await MatchModel.find({ stadiumId: id }).select("id").lean();
      const matchIds = relatedMatches.map((m) => m.id);

      if (matchIds.length > 0) {
        await PredictionModel.deleteMany({ matchId: { $in: matchIds } }, { session });
        await RoundStatisticsModel.deleteMany({ matchId: { $in: matchIds } }, { session });
        await MatchModel.deleteMany({ stadiumId: id }, { session });
      }

      await StadiumModel.deleteOne({ id }, { session });
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

export const adminStadiumStorage = new AdminStadiumStorage();
