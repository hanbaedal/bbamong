import { db } from "../UserStorage/db";
import { users, type User } from "@shared/schema";
import { desc, sql } from "drizzle-orm";

export interface IAdminDonationStorage {
  getTopDonors(
    page: number,
    limit: number,
  ): Promise<{ data: User[]; total: number }>;
}

export class AdminDonationStorage implements IAdminDonationStorage {
  async getTopDonors(
    page: number = 1,
    limit: number = 8,
  ): Promise<{ data: User[]; total: number }> {
    const offset = (page - 1) * limit;

    // 총 유저 수 계산
    const totalResult = await db
      .select({ total: sql<number>`count(${users.id})` })
      .from(users)
      .execute();
    const total = Number(totalResult[0]?.total ?? 0);

    // 페이지 단위 데이터 조회
    const data = await db
      .select()
      .from(users)
      .orderBy(sql`${users.totalDonationAmount} DESC NULLS LAST`)
      .limit(limit)
      .offset(offset)
      .execute();

    return { data, total };
  }
}
