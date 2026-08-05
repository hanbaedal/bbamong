import { AdminUserModel } from "../UserStorage/db";
import { hasActiveSession } from "../sessionValidator";
import { grantLogoutPermission, deleteSession } from "../sessionManager";
import type { AdminPlatform } from "../utils/staffUsername";
import {
  BADMINTON9_MANAGER_MONGO_FILTER,
  PPAMONG_MANAGER_MONGO_FILTER,
  resolveManagerPlatform,
} from "../utils/managerPlatform";

export interface OperatorStatus {
  id: string;
  username: string;
  name: string;
  lastLogin: Date | null;
  lastLogout: Date | null;
  lastLoginIp: string;
  lastLoginRegion: string;
  sessionDuration: string;
  userType: string;
  status: "온라인" | "오프라인";
  platform: AdminPlatform;
}

export interface OperatorListResponse {
  operators: OperatorStatus[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  platform: AdminPlatform;
  counts: { ppamong: number; badminton9: number };
}

export interface IOperatorMonitoringStorage {
  getOperators(page?: number, limit?: number, platform?: AdminPlatform): Promise<OperatorListResponse>;
  forceLogout(operatorId: string): Promise<void>;
}

export class OperatorMonitoringStorage implements IOperatorMonitoringStorage {
  async getOperators(
    page = 1,
    limit = 8,
    platform: AdminPlatform = "ppamong",
  ): Promise<OperatorListResponse> {
    const filter =
      platform === "ppamong" ? PPAMONG_MANAGER_MONGO_FILTER : BADMINTON9_MANAGER_MONGO_FILTER;

    const [total, ppamongCount, badminton9Count] = await Promise.all([
      AdminUserModel.countDocuments(filter),
      AdminUserModel.countDocuments(PPAMONG_MANAGER_MONGO_FILTER),
      AdminUserModel.countDocuments(BADMINTON9_MANAGER_MONGO_FILTER),
    ]);
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;

    const operators = await AdminUserModel.find(filter)
      .select("id username name lastLogin lastLogout lastLoginIp lastLoginRegion userType")
      .sort({ lastLogin: -1, id: 1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const operatorsWithStatus: OperatorStatus[] = await Promise.all(
      operators.map(async (op) => {
        const isOnline = await hasActiveSession("manager", op.id);
        const status: "온라인" | "오프라인" = isOnline ? "온라인" : "오프라인";

        let sessionDuration = "--";
        if (op.lastLogin) {
          if (isOnline) {
            const duration = Date.now() - op.lastLogin.getTime();
            sessionDuration = this.formatDuration(duration);
          } else if (op.lastLogout && op.lastLogout.getTime() > op.lastLogin.getTime()) {
            const duration = op.lastLogout.getTime() - op.lastLogin.getTime();
            sessionDuration = this.formatDuration(duration);
          }
        }

        return {
          id: op.id,
          username: op.username,
          name: op.name,
          userType: op.userType,
          platform: resolveManagerPlatform(op.username),
          status,
          lastLogin: op.lastLogin ?? null,
          lastLogout: op.lastLogout ?? null,
          lastLoginIp: (op as { lastLoginIp?: string }).lastLoginIp ?? "",
          lastLoginRegion: (op as { lastLoginRegion?: string }).lastLoginRegion ?? "",
          sessionDuration,
        };
      }),
    );

    return {
      operators: operatorsWithStatus,
      total,
      page,
      limit,
      totalPages,
      platform,
      counts: { ppamong: ppamongCount, badminton9: badminton9Count },
    };
  }

  async forceLogout(operatorId: string): Promise<void> {
    await deleteSession("manager", operatorId);
    await grantLogoutPermission("manager", operatorId);
  }

  private formatDuration(milliseconds: number): string {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    return `${String(hours).padStart(2, "0")}시간 ${String(minutes).padStart(2, "0")}분`;
  }
}

export const operatorMonitoringStorage = new OperatorMonitoringStorage();
