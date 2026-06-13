import { UserModel } from "../UserStorage/db";
import type { User } from "@shared/schema";

export interface IAdminDonationStorage {
  getTopDonors(page: number, limit: number): Promise<{ data: User[]; total: number }>;
}

export class AdminDonationStorage implements IAdminDonationStorage {
  async getTopDonors(page = 1, limit = 8): Promise<{ data: User[]; total: number }> {
    const offset = (page - 1) * limit;
    const [total, data] = await Promise.all([
      UserModel.countDocuments(),
      UserModel.find()
        .sort({ totalDonationAmount: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
    ]);
    return { data: data as User[], total };
  }
}
