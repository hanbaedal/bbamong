import { UserModel } from "../UserStorage/db";
import type { User } from "@shared/schema";
import {
  type MemberPlatform,
  memberPlatformFilter,
  MEMBER_GUEST_EXCLUSION,
} from "../utils/memberPlatform";

export interface IAdminDonationStorage {
  getTopDonors(
    platform: MemberPlatform,
    page: number,
    limit: number,
  ): Promise<{ data: User[]; total: number }>;
}

export class AdminDonationStorage implements IAdminDonationStorage {
  private donorFilter(platform: MemberPlatform) {
    return {
      ...memberPlatformFilter(platform),
      ...MEMBER_GUEST_EXCLUSION,
      isSuspended: { $ne: 1 },
      totalDonationAmount: { $gt: 0 },
    };
  }

  async getTopDonors(
    platform: MemberPlatform,
    page = 1,
    limit = 8,
  ): Promise<{ data: User[]; total: number }> {
    const offset = (page - 1) * limit;
    const filter = this.donorFilter(platform);
    const [total, data] = await Promise.all([
      UserModel.countDocuments(filter),
      UserModel.find(filter)
        .sort({ totalDonationAmount: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
    ]);
    return { data: data as User[], total };
  }
}
