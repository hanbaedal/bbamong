import { AdvertisementModel, getNextSequence } from "../UserStorage/db";
import type { InsertAdvertisement, Advertisement } from "../../shared/schema";

export interface IAdminAdvertisementStorage {
  getAllAdvertisements(page: number, limit: number): Promise<{ data: Advertisement[]; total: number }>;
  getAdvertisementById(id: number): Promise<Advertisement | undefined>;
  createAdvertisement(data: InsertAdvertisement): Promise<Advertisement>;
  updateAdvertisement(id: number, data: Partial<InsertAdvertisement>): Promise<Advertisement | undefined>;
  deleteAdvertisement(id: number): Promise<boolean>;
}

export class AdminAdvertisementStorage implements IAdminAdvertisementStorage {
  async getAllAdvertisements(page = 1, limit = 8) {
    const offset = (page - 1) * limit;
    const [data, total] = await Promise.all([
      AdvertisementModel.find().sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
      AdvertisementModel.countDocuments(),
    ]);
    return { data: data as Advertisement[], total };
  }

  async getAdvertisementById(id: number): Promise<Advertisement | undefined> {
    const doc = await AdvertisementModel.findOne({ id }).lean();
    return doc ? (doc as Advertisement) : undefined;
  }

  async createAdvertisement(data: InsertAdvertisement): Promise<Advertisement> {
    const adId = await getNextSequence("advertisement");
    const doc = await AdvertisementModel.create({ id: adId, ...data });
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
