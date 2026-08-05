import { UserModel } from "../UserStorage/db";
import {
  type MemberPlatform,
  buildUserPlatformMatchForAgg,
} from "../utils/memberPlatform";

export interface InviteRankingRow {
  userId: string;
  username: string;
  name: string;
  email: string | null;
  inviteCount: number;
}

export interface PaginatedInviteRankings {
  data: InviteRankingRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class AdminInviteStorage {
  async getInviteRankings(
    platform: MemberPlatform,
    page = 1,
    limit = 8,
  ): Promise<PaginatedInviteRankings> {
    const MAX_RANK = 100;
    const offset = (page - 1) * limit;
    const platformMatch = buildUserPlatformMatchForAgg("inviter", platform);

    const allRankings = await UserModel.aggregate<InviteRankingRow>([
      { $match: { referralCode: { $exists: true, $nin: [null, ""] } } },
      { $group: { _id: "$referralCode", inviteCount: { $sum: 1 } } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "inviteCode",
          as: "inviter",
        },
      },
      { $unwind: "$inviter" },
      { $match: platformMatch },
      { $sort: { inviteCount: -1 } },
      { $limit: MAX_RANK },
      {
        $project: {
          _id: 0,
          userId: "$inviter.id",
          username: "$inviter.username",
          name: "$inviter.name",
          email: "$inviter.email",
          inviteCount: 1,
        },
      },
    ]);

    const total = allRankings.length;
    const pageSlice = allRankings.slice(offset, offset + limit);

    return {
      data: pageSlice,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }
}
