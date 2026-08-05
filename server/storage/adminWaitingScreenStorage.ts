import { WaitingScreenModel, getNextSequence } from "../UserStorage/db";
import type { InsertWaitingScreen, WaitingScreen } from "../../shared/schema";
import {
  BADMINTON9_REVENUE_MONGO_FILTER,
  PPAMONG_REVENUE_MONGO_FILTER,
  REVENUE_SOURCE_PPAMONG,
  revenuePlatformFilter,
  type RevenuePlatform,
} from "../utils/revenuePlatform";

export interface PaginatedWaitingScreens {
  data: WaitingScreen[];
  total: number;
  platform: RevenuePlatform;
  counts: { ppamong: number; badminton9: number };
}

export interface IAdminWaitingScreenStorage {
  getAllWaitingScreens(
    page: number,
    limit: number,
    platform?: RevenuePlatform,
  ): Promise<PaginatedWaitingScreens>;
  getWaitingScreenById(id: number): Promise<WaitingScreen | undefined>;
  createWaitingScreen(data: InsertWaitingScreen): Promise<WaitingScreen>;
  updateWaitingScreen(id: number, data: Partial<InsertWaitingScreen>): Promise<WaitingScreen | undefined>;
  deleteWaitingScreen(id: number): Promise<boolean>;
}

export class AdminWaitingScreenStorage implements IAdminWaitingScreenStorage {
  async getAllWaitingScreens(page = 1, limit = 8, platform: RevenuePlatform = "ppamong") {
    const offset = (page - 1) * limit;
    const filter = revenuePlatformFilter(platform);

    const [data, total, ppamongCount, badminton9Count] = await Promise.all([
      WaitingScreenModel.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
      WaitingScreenModel.countDocuments(filter),
      WaitingScreenModel.countDocuments(PPAMONG_REVENUE_MONGO_FILTER),
      WaitingScreenModel.countDocuments(BADMINTON9_REVENUE_MONGO_FILTER),
    ]);

    return {
      data: data as WaitingScreen[],
      total,
      platform,
      counts: { ppamong: ppamongCount, badminton9: badminton9Count },
    };
  }

  async getWaitingScreenById(id: number): Promise<WaitingScreen | undefined> {
    const doc = await WaitingScreenModel.findOne({ id }).lean();
    return doc ? (doc as WaitingScreen) : undefined;
  }

  async createWaitingScreen(data: InsertWaitingScreen): Promise<WaitingScreen> {
    const screenId = await getNextSequence("waitingScreen");
    const doc = await WaitingScreenModel.create({
      id: screenId,
      ...data,
      dataSource: REVENUE_SOURCE_PPAMONG,
    });
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
