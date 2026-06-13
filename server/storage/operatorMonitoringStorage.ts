import { AdminUserModel } from "../UserStorage/db";
import { hasActiveSession } from "../sessionValidator";
import { grantLogoutPermission, deleteSession } from "../sessionManager";

export interface OperatorStatus {
  id: string;
  username: string;
  name: string;
  lastLogin: Date | null;
  lastLogout: Date | null;
  sessionDuration: string;
  userType: string;
  status?: string;
}

export interface OperatorListResponse {
  operators: OperatorStatus[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IOperatorMonitoringStorage {
  getOperators(page?: number, limit?: number): Promise<OperatorListResponse>;
  forceLogout(operatorId: string): Promise<void>;
}

export class OperatorMonitoringStorage implements IOperatorMonitoringStorage {
  async getOperators(page = 1, limit = 8): Promise<OperatorListResponse> {
    const total = await AdminUserModel.countDocuments({ userType: "매니저" });
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    const operators = await AdminUserModel.find({ userType: "매니저" })
      .select("id username name lastLogin lastLogout userType")
      .sort({ lastLogin: -1, id: 1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const operatorsWithStatus: OperatorStatus[] = await Promise.all(
      operators.map(async (op) => {
        const isOnline = await hasActiveSession("manager", op.id);
        const status = isOnline ? "온라인" : "오프라인";
        console.log(
          `[OperatorMonitoring] Manager ${op.id} (${op.username}): session=${isOnline}, status=${status}`,
        );

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
          status,
          lastLogin: op.lastLogin ?? null,
          lastLogout: op.lastLogout ?? null,
          sessionDuration,
        };
      }),
    );

    return { operators: operatorsWithStatus, total, page, limit, totalPages };
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
