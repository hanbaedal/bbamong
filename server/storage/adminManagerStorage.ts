import { AdminUserModel } from "../UserStorage/db";
import type { AdminUser } from "@shared/schema";

type AdminUserWithoutPassword = Omit<AdminUser, "password">;

export interface IAdminManagerStorage {
  getManagers(
    status?: "대기중" | "승인",
    page?: number,
    limit?: number,
    search?: string,
    filterType?: string,
  ): Promise<{
    data: AdminUserWithoutPassword[];
    total: number;
    pendingCount: number;
    approvedCount: number;
  }>;
  approveManager(id: string, approvalStatus: "승인" | "거부"): Promise<void>;
}

export class AdminManagerStorage implements IAdminManagerStorage {
  async getManagers(
    status: "대기중" | "승인" = "대기중",
    page = 1,
    limit = 10,
    search = "",
    filterType = "name",
  ) {
    const offset = (page - 1) * limit;
    const filter: Record<string, unknown> = {
      userType: "매니저",
      approvalStatus: status,
    };

    if (search) {
      const regex = { $regex: search, $options: "i" };
      if (filterType === "name") filter.name = regex;
      else if (filterType === "email") filter.email = regex;
      else if (filterType === "department") filter.department = regex;
      else if (filterType === "position") filter.position = regex;
    }

    const [total, rawData, pendingCount, approvedCount] = await Promise.all([
      AdminUserModel.countDocuments(filter),
      AdminUserModel.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
      AdminUserModel.countDocuments({ userType: "매니저", approvalStatus: "대기중" }),
      AdminUserModel.countDocuments({ userType: "매니저", approvalStatus: "승인" }),
    ]);

    const data = rawData.map(({ password: _password, ...rest }) => rest as AdminUserWithoutPassword);

    return { data, total, pendingCount, approvedCount };
  }

  async approveManager(id: string, approvalStatus: "승인" | "거부"): Promise<void> {
    await AdminUserModel.updateOne({ id }, { approvalStatus });
  }
}

export const adminManagerStorage = new AdminManagerStorage();
