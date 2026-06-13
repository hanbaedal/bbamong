import { db } from "../UserStorage/db";
import { waitingScreens, type InsertWaitingScreen, type WaitingScreen } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IAdminWaitingScreenStorage {
  getAllWaitingScreens(page: number, limit: number): Promise<{ data: WaitingScreen[]; total: number }>;
  getWaitingScreenById(id: number): Promise<WaitingScreen | undefined>;
  createWaitingScreen(data: InsertWaitingScreen): Promise<WaitingScreen>;
  updateWaitingScreen(id: number, data: Partial<InsertWaitingScreen>): Promise<WaitingScreen | undefined>;
  deleteWaitingScreen(id: number): Promise<boolean>;
}

export class AdminWaitingScreenStorage implements IAdminWaitingScreenStorage {
  async getAllWaitingScreens(page: number = 1, limit: number = 8): Promise<{ data: WaitingScreen[]; total: number }> {
    const offset = (page - 1) * limit;

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(waitingScreens)
        .orderBy(desc(waitingScreens.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: waitingScreens.id }).from(waitingScreens),
    ]);

    const total = countResult.length;

    return { data, total };
  }

  async getWaitingScreenById(id: number): Promise<WaitingScreen | undefined> {
    const result = await db
      .select()
      .from(waitingScreens)
      .where(eq(waitingScreens.id, id))
      .limit(1);

    return result[0];
  }

  async createWaitingScreen(data: InsertWaitingScreen): Promise<WaitingScreen> {
    const result = await db
      .insert(waitingScreens)
      .values(data)
      .returning();

    return result[0];
  }

  async updateWaitingScreen(id: number, data: Partial<InsertWaitingScreen>): Promise<WaitingScreen | undefined> {
    const result = await db
      .update(waitingScreens)
      .set(data)
      .where(eq(waitingScreens.id, id))
      .returning();

    return result[0];
  }

  async deleteWaitingScreen(id: number): Promise<boolean> {
    const result = await db
      .delete(waitingScreens)
      .where(eq(waitingScreens.id, id))
      .returning();

    return result.length > 0;
  }
}
