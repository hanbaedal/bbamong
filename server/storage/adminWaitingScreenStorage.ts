import { WaitingScreenModel, getNextSequence } from "../UserStorage/db";
import type { InsertWaitingScreen, WaitingScreen } from "../../shared/schema";

export interface IAdminWaitingScreenStorage {
  getAllWaitingScreens(page: number, limit: number): Promise<{ data: WaitingScreen[]; total: number }>;
  getWaitingScreenById(id: number): Promise<WaitingScreen | undefined>;
  createWaitingScreen(data: InsertWaitingScreen): Promise<WaitingScreen>;
  updateWaitingScreen(id: number, data: Partial<InsertWaitingScreen>): Promise<WaitingScreen | undefined>;
  deleteWaitingScreen(id: number): Promise<boolean>;
}

export class AdminWaitingScreenStorage implements IAdminWaitingScreenStorage {
  async getAllWaitingScreens(page = 1, limit = 8) {
    const offset = (page - 1) * limit;
    const [data, total] = await Promise.all([
      WaitingScreenModel.find().sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
      WaitingScreenModel.countDocuments(),
    ]);
    return { data: data as WaitingScreen[], total };
  }

  async getWaitingScreenById(id: number): Promise<WaitingScreen | undefined> {
    const doc = await WaitingScreenModel.findOne({ id }).lean();
    return doc ? (doc as WaitingScreen) : undefined;
  }

  async createWaitingScreen(data: InsertWaitingScreen): Promise<WaitingScreen> {
    const screenId = await getNextSequence("waitingScreen");
    const doc = await WaitingScreenModel.create({ id: screenId, ...data });
    return doc.toObject() as WaitingScreen;
  }

  async updateWaitingScreen(
    id: number,
    data: Partial<InsertWaitingScreen>,
  ): Promise<WaitingScreen | undefined> {
    const doc = await WaitingScreenModel.findOneAndUpdate({ id }, data, { new: true }).lean();
    return doc ? (doc as WaitingScreen) : undefined;
  }

  async deleteWaitingScreen(id: number): Promise<boolean> {
    const result = await WaitingScreenModel.deleteOne({ id });
    return result.deletedCount > 0;
  }
}
