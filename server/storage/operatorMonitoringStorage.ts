import { db } from "../UserStorage/db";
import { adminUsers } from "@shared/schema";
import { eq, count, desc, asc, sql } from "drizzle-orm";
import { hasActiveSession } from "../sessionValidator";
import { grantLogoutPermission, deleteSession } from "../sessionManager";

export interface OperatorStatus {
  id: string;
  username: string;
  name: string;
  lastLogin: Date | null;
  lastLogout: Date | null;
  sessionDuration: string;
  userType: string
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
  async getOperators(page: number = 1, limit: number = 8): Promise<OperatorListResponse> {
    const totalResult = await db
      .select({ count: count() })
      .from(adminUsers)
      .where(eq(adminUsers.userType, '매니저'))
      .execute();

    const total = totalResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    const operators = await db
    .select({
      id: adminUsers.id,
      username: adminUsers.username,
      name: adminUsers.name,
      lastLogin: adminUsers.lastLogin,
      lastLogout: adminUsers.lastLogout,
      userType: adminUsers.userType
    })
    .from(adminUsers)
    .where(eq(adminUsers.userType, '매니저'))
    .orderBy(sql`${adminUsers.lastLogin} DESC NULLS LAST`, asc(adminUsers.id))
    .limit(limit)
    .offset(offset)
    .execute();
    
    const operatorsWithStatus: OperatorStatus[] = await Promise.all(operators.map(async (op) => {
      const isOnline = await hasActiveSession("manager", op.id);
      const status = isOnline ? "온라인" : "오프라인";
      console.log(`[OperatorMonitoring] Manager ${op.id} (${op.username}): session=${isOnline}, status=${status}`);

      let sessionDuration = "--";
      if (op.lastLogin) {
        if (isOnline) {
          const now = new Date();
          const duration = now.getTime() - op.lastLogin.getTime();
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
        lastLogin: op.lastLogin,
        lastLogout: op.lastLogout,
        sessionDuration,
      };
    }));
    
    return {
      operators: operatorsWithStatus,
      total,
      page,
      limit,
      totalPages,
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
