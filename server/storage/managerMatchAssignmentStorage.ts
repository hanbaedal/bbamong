import { db } from "../UserStorage/db";
import { adminUsers, matches, stadiums, type AdminUser, type Match } from "@shared/schema";
import { eq, and, or, ilike, count, sql } from "drizzle-orm";

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
  async getManagers(search?: string, page: number = 1, limit: number = 8): Promise<ManagerListResponse> {
    const conditions = [eq(adminUsers.userType, "매니저")];

    if (search && search.trim()) {
      conditions.push(
        or(
          ilike(adminUsers.username, `%${search}%`),
          ilike(adminUsers.name, `%${search}%`),
          ilike(adminUsers.id, `%${search}%`)
        )!
      );
    }

    // 전체 개수 카운트
    const totalQuery = db
      .select({ count: count() })
      .from(adminUsers)
      .where(and(...conditions));

    const totalResult = await totalQuery.execute();
    const total = totalResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    // 매니저 목록 가져오기 (조인 없음, assignedMatchNumber만)
    const managers = await db
      .select({
        id: adminUsers.id,
        username: adminUsers.username,
        name: adminUsers.name,
        userType: adminUsers.userType,
        status: adminUsers.status,
        lastLogin: adminUsers.lastLogin,
        assignedMatchNumber: adminUsers.assignedMatchNumber,
      })
      .from(adminUsers)
      .where(and(...conditions))
      .orderBy(
        // 1. 경기 할당된 매니저 먼저 표시
        sql`CASE WHEN ${adminUsers.assignedMatchNumber} IS NULL THEN 1 ELSE 0 END`,
        // 2. 마지막 로그인 시간 최신순
        sql`${adminUsers.lastLogin} DESC NULLS LAST`
      )
      .limit(limit)
      .offset(offset)
      .execute();

    return {
      managers,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getAllMatches(): Promise<MatchWithStadium[]> {
    const matchesWithStadium = await db
      .select({
        id: matches.id,
        name: matches.name,
        startTime: matches.startTime,
        endTime: matches.endTime,
        matchStatus: matches.matchStatus,
        stadiumName: stadiums.name,
      })
      .from(matches)
      .leftJoin(stadiums, eq(matches.stadiumId, stadiums.id))
      .execute();

    return matchesWithStadium.map((row) => ({
      ...row,
      stadiumName: row.stadiumName || "경기장 정보 없음",
    }));
  }

  async assignMatch(managerId: string, matchNumber: string): Promise<void> {
    // 이미 해당 경기 번호가 할당된 다른 매니저가 있는지 확인
    const existingAssignment = await db
      .select()
      .from(adminUsers)
      .where(
        and(
          eq(adminUsers.assignedMatchNumber, matchNumber),
          sql`${adminUsers.id} != ${managerId}`
        )
      )
      .limit(1)
      .execute();

    if (existingAssignment.length > 0) {
      throw new Error(`${matchNumber}는 이미 다른 매니저에게 할당되었습니다.`);
    }

    // 매니저에게 경기 번호 할당
    await db
      .update(adminUsers)
      .set({ assignedMatchNumber: matchNumber })
      .where(eq(adminUsers.id, managerId))
      .execute();
  }

  async unassignMatch(managerId: string): Promise<void> {
    await db
      .update(adminUsers)
      .set({ assignedMatchNumber: null })
      .where(eq(adminUsers.id, managerId))
      .execute();
  }

  async updateManagerStatus(managerId: string, status: string): Promise<void> {
    await db
      .update(adminUsers)
      .set({ status })
      .where(eq(adminUsers.id, managerId))
      .execute();
  }

  async getAvailableMatchNumbers(): Promise<string[]> {
    // 이미 할당된 경기 번호들 가져오기
    const assignedNumbers = await db
      .select({ assignedMatchNumber: adminUsers.assignedMatchNumber })
      .from(adminUsers)
      .where(sql`${adminUsers.assignedMatchNumber} IS NOT NULL`)
      .execute();

    const assignedSet = new Set(assignedNumbers.map((r) => r.assignedMatchNumber));

    // 전체 경기 번호에서 할당된 것 제외
    const allNumbers = ["1경기", "2경기", "3경기", "4경기", "5경기"];
    return allNumbers.filter((num) => !assignedSet.has(num));
  }
}

export const managerMatchAssignmentStorage = new ManagerMatchAssignmentStorage();
