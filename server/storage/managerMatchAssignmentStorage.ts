import { AdminUserModel, MatchModel, StadiumModel } from "../UserStorage/db";

export interface ManagerWithAssignment {
  id: string;
  username: string;
  name: string;
  userType: string;
  status: string;
  lastLogin: Date | null;
  assignedMatchNumber: string | null;
}

export interface MatchWithStadium {
  id: string;
  name: string;
  startTime: Date;
  endTime: Date;
  matchStatus: string;
  stadiumName: string;
}

export interface ManagerListResponse {
  managers: ManagerWithAssignment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IManagerMatchAssignmentStorage {
  getManagers(search?: string, page?: number, limit?: number): Promise<ManagerListResponse>;
  getAllMatches(): Promise<MatchWithStadium[]>;
  assignMatch(managerId: string, matchNumber: string): Promise<void>;
  unassignMatch(managerId: string): Promise<void>;
  updateManagerStatus(managerId: string, status: string): Promise<void>;
  getAvailableMatchNumbers(): Promise<string[]>;
}

export class ManagerMatchAssignmentStorage implements IManagerMatchAssignmentStorage {
  async getManagers(search?: string, page = 1, limit = 8): Promise<ManagerListResponse> {
    const filter: Record<string, unknown> = { userType: "매니저" };

    if (search && search.trim()) {
      const regex = { $regex: search.trim(), $options: "i" };
      filter.$or = [{ username: regex }, { name: regex }, { id: regex }];
    }

    const total = await AdminUserModel.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    const managers = await AdminUserModel.find(filter)
      .select("id username name userType status lastLogin assignedMatchNumber")
      .sort({ assignedMatchNumber: 1, lastLogin: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    return {
      managers: managers as ManagerWithAssignment[],
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getAllMatches(): Promise<MatchWithStadium[]> {
    const matches = await MatchModel.find().lean();

    return Promise.all(
      matches.map(async (row) => {
        const stadium = await StadiumModel.findOne({ id: row.stadiumId }).select("name").lean();
        return {
          id: row.id,
          name: row.name,
          startTime: row.startTime,
          endTime: row.endTime,
          matchStatus: row.matchStatus,
          stadiumName: stadium?.name || "경기장 정보 없음",
        };
      }),
    );
  }

  async assignMatch(managerId: string, matchNumber: string): Promise<void> {
    const existingAssignment = await AdminUserModel.findOne({
      assignedMatchNumber: matchNumber,
      id: { $ne: managerId },
    }).lean();

    if (existingAssignment) {
      throw new Error(`${matchNumber}는 이미 다른 매니저에게 할당되었습니다.`);
    }

    await AdminUserModel.updateOne({ id: managerId }, { assignedMatchNumber: matchNumber });
  }

  async unassignMatch(managerId: string): Promise<void> {
    await AdminUserModel.updateOne({ id: managerId }, { assignedMatchNumber: null });
  }

  async updateManagerStatus(managerId: string, status: string): Promise<void> {
    await AdminUserModel.updateOne({ id: managerId }, { status });
  }

  async getAvailableMatchNumbers(): Promise<string[]> {
    const assigned = await AdminUserModel.find({
      assignedMatchNumber: { $ne: null },
    })
      .select("assignedMatchNumber")
      .lean();

    const assignedSet = new Set(assigned.map((r) => r.assignedMatchNumber));
    const allNumbers = ["1경기", "2경기", "3경기", "4경기", "5경기"];
    return allNumbers.filter((num) => !assignedSet.has(num));
  }
}

export const managerMatchAssignmentStorage = new ManagerMatchAssignmentStorage();
