import { db } from "./db";
import { notices } from "@shared/schema";
import { eq, desc, asc, sql } from "drizzle-orm";
import type { Notice, InsertNotice } from "@shared/schema";

export class NoticeStorage {
  async createNotice(notice: InsertNotice): Promise<Notice> {
    const result = await db.insert(notices).values(notice).returning();
    return result[0];
  }

  async getAllNotices(): Promise<Notice[]> {
    return await db.select().from(notices).orderBy(asc(notices.displayOrder), desc(notices.createdAt));
  }

  async getNotice(id: number): Promise<Notice | undefined> {
    const result = await db.select().from(notices).where(eq(notices.id, id));
    return result[0];
  }

  async updateNotice(
    id: number,
    data: Partial<InsertNotice>
  ): Promise<Notice | undefined> {
    const result = await db
      .update(notices)
      .set({ ...data, updatedAt: sql`now()` })
      .where(eq(notices.id, id))
      .returning();
    return result[0];
  }

  async deleteNotice(id: number): Promise<void> {
    await db.delete(notices).where(eq(notices.id, id));
  }

  async updateNoticeOrders(updates: { id: number; displayOrder: number }[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(notices)
          .set({ displayOrder: update.displayOrder })
          .where(eq(notices.id, update.id));
      }
    });
  }

  async getMaxDisplayOrder(): Promise<number> {
    const result = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX(${notices.displayOrder}), -1)` })
      .from(notices);
    return result[0]?.maxOrder ?? 0;
  }
}

export const noticeStorage = new NoticeStorage();
