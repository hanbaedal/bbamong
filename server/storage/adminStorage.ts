import { db } from "../UserStorage/db";
import { adminUsers, users, type InsertAdminUser, type AdminUser, type User } from "@shared/schema";
import { eq, desc, sql, and, or, ilike, ne, notInArray } from "drizzle-orm";

export interface IAdminStorage {
  createAdminUser(data: InsertAdminUser): Promise<AdminUser>;
  getAdminUserById(id: string): Promise<AdminUser | undefined>;
  getAdminUserByEmail(email: string, approvedOnly?: boolean): Promise<AdminUser | undefined>;
  getAdminUserByUsername(username: string, approvedOnly?: boolean): Promise<AdminUser | undefined>;
  getAdminUserByPhone(phone: string, approvedOnly?: boolean): Promise<AdminUser | undefined>;
  getAllAdminUsers(): Promise<AdminUser[]>;
  updateAdminUser(id: string, data: Partial<AdminUser>): Promise<AdminUser | undefined>;
  deleteAdminUser(id: string): Promise<boolean>;
  updateApprovalStatus(id: string, status: "대기중" | "승인" | "거부"): Promise<AdminUser | undefined>;
  getAllRegularUsers(): Promise<User[]>;
  suspendUser(userId: string, isSuspended: boolean): Promise<User | undefined>;
  getTopDonors(page: number, limit: number): Promise<{ data: User[]; total: number }>;
  getAdminUsersByStatus(status: "대기중" | "승인" | "거부", page: number, limit: number): Promise<{ data: AdminUser[]; total: number; pendingCount: number; approvedCount: number }>;
  searchAdminUsersByStatus(
    status: "대기중" | "승인" | "거부",
    searchQuery: string,
    filterType: "전체" | "부서" | "직책",
    page: number,
    limit: number
  ): Promise<{ data: AdminUser[]; total: number; pendingCount: number; approvedCount: number }>;
}

export class AdminStorage implements IAdminStorage {
  async createAdminUser(data: InsertAdminUser): Promise<AdminUser> {
    const cleanData = {
      ...data,
      phone: data.phone ? data.phone.replace(/-/g, "") : data.phone,
    };
    const result = await db
      .insert(adminUsers)
      .values(cleanData)
      .returning();

    return result[0];
  }

  async getAdminUserById(id: string): Promise<AdminUser | undefined> {
    const result = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, id))
      .limit(1);

    return result[0];
  }

  async getAdminUserByEmail(email: string, approvedOnly: boolean = false): Promise<AdminUser | undefined> {
    const conditions = approvedOnly
      ? and(eq(adminUsers.email, email), eq(adminUsers.approvalStatus, "승인"))
      : eq(adminUsers.email, email);
    const result = await db
      .select()
      .from(adminUsers)
      .where(conditions)
      .limit(1);

    return result[0];
  }

  async getAdminUserByUsername(username: string, approvedOnly: boolean = false): Promise<AdminUser | undefined> {
    const conditions = approvedOnly
      ? and(eq(adminUsers.username, username), eq(adminUsers.approvalStatus, "승인"))
      : eq(adminUsers.username, username);
    const result = await db
      .select()
      .from(adminUsers)
      .where(conditions)
      .limit(1);

    return result[0];
  }

  async getAdminUserByPhone(phone: string, approvedOnly: boolean = false): Promise<AdminUser | undefined> {
    const cleanPhone = phone.replace(/-/g, "");
    const phoneMatch = sql`REPLACE(${adminUsers.phone}, '-', '') = ${cleanPhone}`;
    const conditions = approvedOnly
      ? and(phoneMatch, eq(adminUsers.approvalStatus, "승인"))
      : phoneMatch;
    const result = await db
      .select()
      .from(adminUsers)
      .where(conditions)
      .limit(1);

    return result[0];
  }

  async getAllAdminUsers(): Promise<AdminUser[]> {
    const result = await db
      .select()
      .from(adminUsers)
      .orderBy(desc(adminUsers.createdAt));

    return result;
  }

  async updateAdminUser(id: string, data: Partial<AdminUser>): Promise<AdminUser | undefined> {
    const cleanData = {
      ...data,
      ...(data.phone ? { phone: data.phone.replace(/-/g, "") } : {}),
    };
    const result = await db
      .update(adminUsers)
      .set(cleanData)
      .where(eq(adminUsers.id, id))
      .returning();

    return result[0];
  }

  async deleteAdminUser(id: string): Promise<boolean> {
    const result = await db
      .delete(adminUsers)
      .where(eq(adminUsers.id, id))
      .returning();

    return result.length > 0;
  }

  async updateApprovalStatus(id: string, status: "대기중" | "승인" | "거부"): Promise<AdminUser | undefined> {
    const result = await db
      .update(adminUsers)
      .set({ approvalStatus: status })
      .where(eq(adminUsers.id, id))
      .returning();

    return result[0];
  }

  async getAllRegularUsers(): Promise<User[]> {
    const result = await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));

    return result;
  }

  async suspendUser(userId: string, isSuspended: boolean): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ isSuspended: isSuspended ? 1 : 0 })
      .where(eq(users.id, userId))
      .returning();

    return result[0];
  }

  async getAdminUsersByStatus(
    status: "대기중" | "승인" | "거부",
    page: number = 1,
    limit: number = 8
  ): Promise<{ data: AdminUser[]; total: number; pendingCount: number; approvedCount: number }> {
    const offset = (page - 1) * limit;

    // 조회 조건: 상태 + 매니저/슈퍼어드민 제외
    const excludedTypes = ['매니저', '슈퍼어드민'];
    const baseCondition = and(
      eq(adminUsers.approvalStatus, status),
      notInArray(adminUsers.userType, excludedTypes)
    );

    // 총 개수
    const totalResult = await db
      .select({ total: sql<number>`count(${adminUsers.id})` })
      .from(adminUsers)
      .where(baseCondition)
      .execute();
    const total = Number(totalResult[0]?.total ?? 0);

    // 대기중 인원 수
    const pendingResult = await db
      .select({ count: sql<number>`count(${adminUsers.id})` })
      .from(adminUsers)
      .where(and(eq(adminUsers.approvalStatus, "대기중"), notInArray(adminUsers.userType, excludedTypes)))
      .execute();
    const pendingCount = Number(pendingResult[0]?.count ?? 0);

    // 승인 인원 수
    const approvedResult = await db
      .select({ count: sql<number>`count(${adminUsers.id})` })
      .from(adminUsers)
      .where(and(eq(adminUsers.approvalStatus, "승인"), notInArray(adminUsers.userType, excludedTypes)))
      .execute();
    const approvedCount = Number(approvedResult[0]?.count ?? 0);

    // 페이지 단위로 데이터 조회
    const data = await db
      .select()
      .from(adminUsers)
      .where(baseCondition)
      .orderBy(desc(adminUsers.createdAt))
      .limit(limit)
      .offset(offset)
      .execute();

    return { data, total, pendingCount, approvedCount };
  }

  async searchAdminUsersByStatus(
    status: "대기중" | "승인" | "거부",
    searchQuery: string,
    filterType: "전체" | "부서" | "직책",
    page: number = 1,
    limit: number = 8
  ): Promise<{ data: AdminUser[]; total: number; pendingCount: number; approvedCount: number }> {
    const offset = (page - 1) * limit;
    const excludedTypes = ['매니저', '슈퍼어드민'];

    // 검색 조건 구성
    const searchConditions = [];
    if (filterType === "전체") {
      searchConditions.push(
        or(
          ilike(adminUsers.department, `%${searchQuery}%`),
          ilike(adminUsers.position, `%${searchQuery}%`),
          ilike(adminUsers.name, `%${searchQuery}%`),
          ilike(adminUsers.email, `%${searchQuery}%`)
        )
      );
    } else if (filterType === "부서") {
      searchConditions.push(ilike(adminUsers.department, `%${searchQuery}%`));
    } else if (filterType === "직책") {
      searchConditions.push(ilike(adminUsers.position, `%${searchQuery}%`));
    }

    const whereCondition = and(
      eq(adminUsers.approvalStatus, status),
      notInArray(adminUsers.userType, excludedTypes),
      ...searchConditions
    );

    // 총 개수
    const totalResult = await db
      .select({ total: sql<number>`count(${adminUsers.id})` })
      .from(adminUsers)
      .where(whereCondition)
      .execute();
    const total = Number(totalResult[0]?.total ?? 0);

    // 대기중 인원 수
    const pendingResult = await db
      .select({ count: sql<number>`count(${adminUsers.id})` })
      .from(adminUsers)
      .where(and(eq(adminUsers.approvalStatus, "대기중"), notInArray(adminUsers.userType, excludedTypes)))
      .execute();
    const pendingCount = Number(pendingResult[0]?.count ?? 0);

    // 승인 인원 수
    const approvedResult = await db
      .select({ count: sql<number>`count(${adminUsers.id})` })
      .from(adminUsers)
      .where(and(eq(adminUsers.approvalStatus, "승인"), notInArray(adminUsers.userType, excludedTypes)))
      .execute();
    const approvedCount = Number(approvedResult[0]?.count ?? 0);

    // 페이지 단위 데이터 조회
    const data = await db
      .select()
      .from(adminUsers)
      .where(whereCondition)
      .orderBy(desc(adminUsers.createdAt))
      .limit(limit)
      .offset(offset)
      .execute();

    return { data, total, pendingCount, approvedCount };
  }

  async getTopDonors(page: number = 1, limit: number = 8): Promise<{ data: User[]; total: number }> {
    const offset = (page - 1) * limit;

    // 총 개수
    const totalResult = await db
      .select({ total: sql<number>`count(${users.id})` })
      .from(users)
      .execute();
    const total = Number(totalResult[0]?.total ?? 0);

    // 기부 금액 기준 정렬
    const data = await db
      .select()
      .from(users)
      .orderBy(desc(users.totalDonationAmount))
      .limit(limit)
      .offset(offset)
      .execute();

    return { data, total };
  }
}
