import { db } from "./db";
import { pointTransactions, users } from "@shared/schema";
import { eq, sql, and } from "drizzle-orm";
import type { PointTransaction, InsertPointTransaction } from "@shared/schema";

export class PointStorage {
  /**
   * 트랜잭션 내에서 포인트 업데이트하는 내부 헬퍼 (재사용 가능)
   * @param tx 트랜잭션 객체
   * @param userId 사용자 ID
   * @param amount 포인트 변경량
   * @param description 거래 설명
   * @param transactionType 거래 유형
   */
  async _updateUserPointsInTx(
    tx: any,
    userId: string,
    amount: number,
    description: string,
    transactionType: 'earned' | 'spent' | 'donation' | 'attendance'
  ): Promise<{ transaction: PointTransaction; newBalance: number }> {
    // 1. users.points 업데이트
    await tx.execute(
      sql`UPDATE users SET points = points + ${amount} WHERE id = ${userId}`
    );

    // 2. 업데이트된 포인트 조회
    const [user] = await tx
      .select({ points: users.points })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }

    const newBalance = user.points;

    // 3. pointTransactions 레코드 생성
    const [transaction] = await tx
      .insert(pointTransactions)
      .values({
        userId,
        transactionType,
        amount,
        balance: newBalance,
        description,
      })
      .returning();

    return { transaction, newBalance };
  }

  /**
   * 통합 포인트 업데이트 메서드 (외부 호출용)
   * users.points와 pointTransactions를 원자적으로 업데이트
   * @param userId 사용자 ID
   * @param amount 포인트 변경량 (양수: 획득, 음수: 사용)
   * @param description 거래 설명
   * @param transactionType 거래 유형 (earned, spent, donation, attendance 등)
   * @returns 업데이트된 포인트 트랜잭션
   */
  async updateUserPoints(
    userId: string,
    amount: number,
    description: string,
    transactionType: 'earned' | 'spent' | 'donation' | 'attendance' = amount > 0 ? 'earned' : 'spent'
  ): Promise<{ transaction: PointTransaction; newBalance: number }> {
    return await db.transaction(async (tx) => {
      return await this._updateUserPointsInTx(tx, userId, amount, description, transactionType);
    });
  }
  // 특정 사용자의 포인트 거래 내역 조회 (페이지네이션)
  async getTransactionsByUser(userId: string, limit = 20, offset = 0): Promise<Array<PointTransaction & { userName: string }>> {
    const result = await db
      .select({
        id: pointTransactions.id,
        userId: pointTransactions.userId,
        transactionType: pointTransactions.transactionType,
        amount: pointTransactions.amount,
        balance: pointTransactions.balance,
        description: pointTransactions.description,
        createdAt: pointTransactions.createdAt,
        userName: users.name,
      })
      .from(pointTransactions)
      .leftJoin(users, eq(pointTransactions.userId, users.id))
      .where(eq(pointTransactions.userId, userId))
      .orderBy(sql`${pointTransactions.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    return result.map(row => ({
      ...row,
      userName: row.userName || "Unknown",
    }));
  }

  // 포인트 거래 추가 (획득/사용)
  async addTransaction(transaction: InsertPointTransaction): Promise<PointTransaction> {
    // 잔액 계산: 마지막 거래 잔액 + 현재 거래 amount
    const lastTransaction = await db
      .select({ balance: pointTransactions.balance })
      .from(pointTransactions)
      .where(eq(pointTransactions.userId, transaction.userId))
      .orderBy(sql`${pointTransactions.id} DESC`)
      .limit(1);

    const previousBalance = lastTransaction[0]?.balance || 0;
    const newBalance = previousBalance + transaction.amount;

    const result = await db.insert(pointTransactions)
      .values({ ...transaction, balance: newBalance })
      .returning();

    return result[0];
  }

  // 특정 거래 조회
  async getTransaction(id: number): Promise<PointTransaction | undefined> {
    const result = await db.select().from(pointTransactions).where(eq(pointTransactions.id, id));
    return result[0];
  }

  // 특정 사용자의 총 포인트 계산
  async getTotalPoints(userId: string): Promise<number> {
    const result = await db
      .select({ total: sql<number>`COALESCE(SUM(${pointTransactions.amount}), 0)` })
      .from(pointTransactions)
      .where(eq(pointTransactions.userId, userId));

    return result[0]?.total || 0;
  }

  // 특정 거래 삭제
  async deleteTransaction(id: number): Promise<{ success: boolean; message: string }> {
    const existing = await db.select().from(pointTransactions).where(eq(pointTransactions.id, id));
    if (!existing[0]) return { success: false, message: "거래를 찾을 수 없습니다." };

    await db.delete(pointTransactions).where(eq(pointTransactions.id, id));
    return { success: true, message: "거래가 삭제되었습니다." };
  }

  async getDonationsByUser(userId: string, page = 1, limit = 10): Promise<{
    donations: Array<PointTransaction & { userName: string }>;
    totalAmount: number;
    totalCount: number;
  }> {
    const offset = (page - 1) * limit;

    // 총합 계산 (기부는 음수로 기록되므로 각 금액의 절대값 합계로 계산)
    const totalQuery = await db
      .select({
        totalAmount: sql<number>`COALESCE(SUM(ABS(${pointTransactions.amount})), 0)`,
      })
      .from(pointTransactions)
      .where(
        and(
          eq(pointTransactions.userId, userId),
          eq(pointTransactions.transactionType, "donation")
        )
      );

    const totalAmount = totalQuery[0]?.totalAmount || 0;

    // 전체 건수
    const countQuery = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(pointTransactions)
      .where(
        and(
          eq(pointTransactions.userId, userId),
          eq(pointTransactions.transactionType, "donation")
        )
      );

    const totalCount = countQuery[0]?.count || 0;

    // 실제 리스트 (기부는 음수로 기록되므로 절대값으로 반환)
    const result = await db
      .select({
        id: pointTransactions.id,
        userId: pointTransactions.userId,
        transactionType: pointTransactions.transactionType,
        amount: sql<number>`ABS(${pointTransactions.amount})`,
        balance: pointTransactions.balance,
        description: pointTransactions.description,
        createdAt: pointTransactions.createdAt,
        userName: users.name,
      })
      .from(pointTransactions)
      .leftJoin(users, eq(pointTransactions.userId, users.id))
      .where(
        and(
          eq(pointTransactions.userId, userId),
          eq(pointTransactions.transactionType, "donation")
        )
      )
      .orderBy(sql`${pointTransactions.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    return {
      donations: result.map((r) => ({
        ...r,
        userName: r.userName || "Unknown",
      })),
      totalAmount,
      totalCount,
    };
  }

  async getEarnedPointsRankings(page = 1, limit = 8): Promise<{
    data: Array<{
      userId: string;
      username: string;
      name: string;
      earnedPoints: number;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * limit;
    const MAX_RANK = 100; // 상위 100명만

    // 상위 100명 count
    const totalResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(
        db
          .select({
            userId: pointTransactions.userId,
            earnedPoints: sql<number>`SUM(${pointTransactions.amount})`,
          })
          .from(pointTransactions)
          .where(eq(pointTransactions.transactionType, 'earned'))
          .groupBy(pointTransactions.userId)
          .orderBy(sql`SUM(${pointTransactions.amount}) DESC`)
          .limit(MAX_RANK)
          .as('top100')
      );

    const total = totalResult[0]?.count || 0;

    // 상위 100명 중 페이지네이션
    const rankings = await db
      .select({
        userId: pointTransactions.userId,
        username: users.username,
        name: users.name,
        earnedPoints: sql<number>`SUM(${pointTransactions.amount})`,
      })
      .from(pointTransactions)
      .innerJoin(users, eq(pointTransactions.userId, users.id))
      .where(eq(pointTransactions.transactionType, 'earned'))
      .groupBy(pointTransactions.userId, users.username, users.name)
      .orderBy(sql`SUM(${pointTransactions.amount}) DESC`)
      .limit(limit)
      .offset(offset > MAX_RANK ? MAX_RANK : offset); // offset이 100 넘어가면 안 됨

    return {
      data: rankings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getDonationRankByUser(userId: string): Promise<{
    rank: number;
    totalAmount: number;
  }> {
    // 기부 총액 계산 (각 금액의 절대값 합계)
    const totalQuery = await db
      .select({
        totalAmount: sql<number>`COALESCE(SUM(ABS(${pointTransactions.amount})), 0)`,
      })
      .from(pointTransactions)
      .where(
        and(
          eq(pointTransactions.userId, userId),
          eq(pointTransactions.transactionType, "donation")
        )
      );

    const totalAmount = totalQuery[0]?.totalAmount || 0;

    // 랭킹 계산: 해당 사용자보다 기부를 많이 한 사람의 수 + 1
    const rankQuery = await db
      .select({
        rank: sql<number>`COUNT(*) + 1`,
      })
      .from(
        db
          .select({
            userId: pointTransactions.userId,
            donationTotal: sql<number>`COALESCE(SUM(ABS(${pointTransactions.amount})), 0)`,
          })
          .from(pointTransactions)
          .where(eq(pointTransactions.transactionType, "donation"))
          .groupBy(pointTransactions.userId)
          .having(sql`COALESCE(SUM(ABS(${pointTransactions.amount})), 0) > ${totalAmount}`)
          .as("donation_totals")
      );

    const rank = rankQuery[0]?.rank || 1;

    return {
      rank,
      totalAmount,
    };
  }

}

export const pointStorage = new PointStorage();
