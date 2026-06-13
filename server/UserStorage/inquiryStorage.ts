import { db } from "./db";
import { inquiries, users } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import type { Inquiry, InsertInquiry } from "@shared/schema";

export class InquiryStorage {
  async createInquiry(inquiry: InsertInquiry): Promise<Inquiry> {
    const result = await db.insert(inquiries).values(inquiry).returning();
    return result[0];
  }

  async getInquiriesByUser(
    userId: string
  ): Promise<Array<Inquiry & { userName: string }>> {
    const result = await db
      .select({
        id: inquiries.id,
        userId: inquiries.userId,
        category: inquiries.category,
        title: inquiries.title,
        content: inquiries.content,
        status: inquiries.status,
        response: inquiries.response,
        createdAt: inquiries.createdAt,
        userName: users.name,
      })
      .from(inquiries)
      .leftJoin(users, eq(inquiries.userId, users.id))
      .where(eq(inquiries.userId, userId))
      .orderBy(desc(inquiries.id));

    return result.map((row) => ({
      id: row.id,
      userId: row.userId,
      category: row.category,
      title: row.title,
      content: row.content,
      status: row.status,
      response: row.response,
      createdAt: row.createdAt,
      userName: row.userName || "Unknown",
    }));
  }

  async getInquiry(
    id: number
  ): Promise<(Inquiry & { userName: string }) | undefined> {
    const result = await db
      .select({
        id: inquiries.id,
        userId: inquiries.userId,
        category: inquiries.category,
        title: inquiries.title,
        content: inquiries.content,
        status: inquiries.status,
        response: inquiries.response,
        createdAt: inquiries.createdAt,
        userName: users.name,
      })
      .from(inquiries)
      .leftJoin(users, eq(inquiries.userId, users.id))
      .where(eq(inquiries.id, id));

    if (!result[0]) return undefined;

    return {
      id: result[0].id,
      userId: result[0].userId,
      category: result[0].category,
      title: result[0].title,
      content: result[0].content,
      status: result[0].status,
      response: result[0].response,
      createdAt: result[0].createdAt,
      userName: result[0].userName || "Unknown",
    };
  }

  async updateInquiryStatus(
    id: number,
    status: string,
    response?: string
  ): Promise<Inquiry | undefined> {
    const updateData: any = { status };
    if (response !== undefined) {
      updateData.response = response;
    }
    
    const result = await db
      .update(inquiries)
      .set(updateData)
      .where(eq(inquiries.id, id))
      .returning();
    return result[0];
  }

  async deleteInquiry(id: number): Promise<void> {
    await db.delete(inquiries).where(eq(inquiries.id, id));
  }

  async getAllInquiries(status?: string, page: number = 1, limit: number = 8): Promise<{
    data: Array<Inquiry & { userName: string; userUsername: string }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    pendingCount: number;
    resolvedCount: number;
  }> {
    const { sql: rawSql, and, or, count } = await import("drizzle-orm");
    
    // 상태별 조건 설정
    let statusCondition;
    if (status === "답변 대기") {
      statusCondition = eq(inquiries.status, "pending");
    } else if (status === "답변 완료") {
      statusCondition = eq(inquiries.status, "resolved");
    }
    
    // 전체 카운트
    const [totalResult] = await db
      .select({ count: count() })
      .from(inquiries)
      .where(statusCondition);
    
    const total = totalResult?.count || 0;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    
    // 데이터 조회
    const queryBuilder = db
      .select({
        id: inquiries.id,
        userId: inquiries.userId,
        category: inquiries.category,
        title: inquiries.title,
        content: inquiries.content,
        status: inquiries.status,
        response: inquiries.response,
        createdAt: inquiries.createdAt,
        userName: users.name,
        userUsername: users.username,
      })
      .from(inquiries)
      .leftJoin(users, eq(inquiries.userId, users.id))
      .orderBy(desc(inquiries.id))
      .limit(limit)
      .offset(offset);
    
    if (statusCondition) {
      queryBuilder.where(statusCondition);
    }
    
    const result = await queryBuilder;
    
    // 각 상태별 카운트
    const [pendingCountResult] = await db
      .select({ count: count() })
      .from(inquiries)
      .where(eq(inquiries.status, "pending"));
    
    const [resolvedCountResult] = await db
      .select({ count: count() })
      .from(inquiries)
      .where(eq(inquiries.status, "resolved"));
    
    const pendingCount = pendingCountResult?.count || 0;
    const resolvedCount = resolvedCountResult?.count || 0;
    
    return {
      data: result.map((row) => ({
        id: row.id,
        userId: row.userId,
        category: row.category,
        title: row.title,
        content: row.content,
        status: row.status,
        response: row.response,
        createdAt: row.createdAt,
        userName: row.userName || "Unknown",
        userUsername: row.userUsername || "Unknown",
      })),
      total,
      page,
      limit,
      totalPages,
      pendingCount,
      resolvedCount,
    };
  }
}

export const inquiryStorage = new InquiryStorage();
