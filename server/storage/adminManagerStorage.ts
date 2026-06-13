import { db } from "../UserStorage/db";
import { adminUsers, type AdminUser } from "@shared/schema";
import { eq, desc, sql, and, ilike } from "drizzle-orm";

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
    page: number = 1,
    limit: number = 10,
    search: string = "",
    filterType: string = "name",
  ): Promise<{
    data: AdminUserWithoutPassword[];
    total: number;
    pendingCount: number;
    approvedCount: number;
  }> {
    const offset = (page - 1) * limit;

    let searchCondition;
    if (search) {
      const searchPattern = `%${search}%`;
      if (filterType === "name") {
        searchCondition = and(
          eq(adminUsers.userType, "매니저"),
          eq(adminUsers.approvalStatus, status),
          ilike(adminUsers.name, searchPattern),
        );
      } else if (filterType === "email") {
        searchCondition = and(
          eq(adminUsers.userType, "매니저"),
          eq(adminUsers.approvalStatus, status),
          ilike(adminUsers.email, searchPattern),
        );
      } else if (filterType === "department") {
        searchCondition = and(
          eq(adminUsers.userType, "매니저"),
          eq(adminUsers.approvalStatus, status),
          ilike(adminUsers.department, searchPattern),
        );
      } else if (filterType === "position") {
        searchCondition = and(
          eq(adminUsers.userType, "매니저"),
          eq(adminUsers.approvalStatus, status),
          ilike(adminUsers.position, searchPattern),
        );
      } else {
        searchCondition = and(
          eq(adminUsers.userType, "매니저"),
          eq(adminUsers.approvalStatus, status),
        );
      }
    } else {
      searchCondition = and(
        eq(adminUsers.userType, "매니저"),
        eq(adminUsers.approvalStatus, status),
      );
    }

    const totalResult = await db
      .select({
        total: sql<number>`count(${adminUsers.id})`,
      })
      .from(adminUsers)
      .where(searchCondition)
      .execute();

    const total = Number(totalResult[0]?.total ?? 0);

    const rawData = await db
      .select()
      .from(adminUsers)
      .where(searchCondition)
      .orderBy(desc(adminUsers.createdAt))
      .limit(limit)
      .offset(offset)
      .execute();

    const data = rawData.map(({ password, ...rest }) => rest);

    const pendingCountResult = await db
      .select({
        count: sql<number>`count(${adminUsers.id})`,
      })
      .from(adminUsers)
      .where(
        and(
          eq(adminUsers.userType, "매니저"),
          eq(adminUsers.approvalStatus, "대기중"),
        ),
      )
      .execute();

    const approvedCountResult = await db
      .select({
        count: sql<number>`count(${adminUsers.id})`,
      })
      .from(adminUsers)
      .where(
        and(
          eq(adminUsers.userType, "매니저"),
          eq(adminUsers.approvalStatus, "승인"),
        ),
      )
      .execute();

    const pendingCount = Number(pendingCountResult[0]?.count ?? 0);
    const approvedCount = Number(approvedCountResult[0]?.count ?? 0);

    return {
      data,
      total,
      pendingCount,
      approvedCount,
    };
  }

  async approveManager(id: string, approvalStatus: "승인" | "거부"): Promise<void> {
    await db
      .update(adminUsers)
      .set({ approvalStatus })
      .where(eq(adminUsers.id, id))
      .execute();
  }
}

export const adminManagerStorage = new AdminManagerStorage();
