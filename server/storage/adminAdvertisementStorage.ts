import { AdvertisementModel, getNextSequence } from "../UserStorage/db";
import type { InsertAdvertisement, Advertisement } from "../../shared/schema";
import {
  BADMINTON9_REVENUE_MONGO_FILTER,
  PPAMONG_REVENUE_MONGO_FILTER,
  REVENUE_SOURCE_PPAMONG,
  revenuePlatformFilter,
  type RevenuePlatform,
} from "../utils/revenuePlatform";

export interface PaginatedAdvertisements {
  data: Advertisement[];
  total: number;
  platform: RevenuePlatform;
  counts: { ppamong: number; badminton9: number };
}

export interface IAdminAdvertisementStorage {
  getAllAdvertisements(
    page: number,
    limit: number,
    platform?: RevenuePlatform,
  ): Promise<PaginatedAdvertisements>;
  getAdvertisementById(id: number): Promise<Advertisement | undefined>;
  createAdvertisement(data: InsertAdvertisement): Promise<Advertisement>;
  updateAdvertisement(id: number, data: Partial<InsertAdvertisement>): Promise<Advertisement | undefined>;
  deleteAdvertisement(id: number): Promise<boolean>;
}

export class AdminAdvertisementStorage implements IAdminAdvertisementStorage {
  async getAllAdvertisements(page = 1, limit = 8, platform: RevenuePlatform = "ppamong") {
    const offset = (page - 1) * limit;
    const filter = revenuePlatformFilter(platform);

    const [data, total, ppamongCount, badminton9Count] = await Promise.all([
      AdvertisementModel.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
      AdvertisementModel.countDocuments(filter),
      AdvertisementModel.countDocuments(PPAMONG_REVENUE_MONGO_FILTER),
      AdvertisementModel.countDocuments(BADMINTON9_REVENUE_MONGO_FILTER),
    ]);

    return {
      data: data as Advertisement[],
      total,
      platform,
      counts: { ppamong: ppamongCount, badminton9: badminton9Count },
    };
  }

  async getAdvertisementById(id: number): Promise<Advertisement | undefined> {
    const doc = await AdvertisementModel.findOne({ id }).lean();
    return doc ? (doc as Advertisement) : undefined;
  }

  async createAdvertisement(data: InsertAdvertisement): Promise<Advertisement> {
    const adId = await getNextSequence("advertisement");
    const doc = await AdvertisementModel.create({
      id: adId,
      ...data,
      dataSource: REVENUE_SOURCE_PPAMONG,
    });
    return doc.toObject() as Advertisement;
  }

  async updateAdvertisement(
    id: number,
    data: Partial<InsertAdvertisement>,
  ): Promise<Advertisement | undefined> {
    const doc = await AdvertisementModel.findOneAndUpdate({ id }, data, { new: true }).lean();
    return doc ? (doc as Advertisement) : undefined;
  }

  async deleteAdvertisement(id: number): Promise<boolean> {
    const result = await AdvertisementModel.deleteOne({ id });
    return result.deletedCount > 0;
  }
}
