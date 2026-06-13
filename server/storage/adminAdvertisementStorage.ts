import { db } from "../UserStorage/db";
import { advertisements, type InsertAdvertisement, type Advertisement } from "../../shared/schema";
import { eq, desc, count } from "drizzle-orm";

export interface IAdminAdvertisementStorage {
  getAllAdvertisements(page: number, limit: number): Promise<{ data: Advertisement[]; total: number }>;
  getAdvertisementById(id: number): Promise<Advertisement | undefined>;
  createAdvertisement(data: InsertAdvertisement): Promise<Advertisement>;
  updateAdvertisement(id: number, data: Partial<InsertAdvertisement>): Promise<Advertisement | undefined>;
  deleteAdvertisement(id: number): Promise<boolean>;
}

export class AdminAdvertisementStorage implements IAdminAdvertisementStorage {
  async getAllAdvertisements(page: number = 1, limit: number = 8): Promise<{ data: Advertisement[]; total: number }> {
    const offset = (page - 1) * limit;

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(advertisements)
        .orderBy(desc(advertisements.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(advertisements),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return { data, total };
  }

  async getAdvertisementById(id: number): Promise<Advertisement | undefined> {
    const result = await db
      .select()
      .from(advertisements)
      .where(eq(advertisements.id, id))
      .limit(1);

    return result[0];
  }

  async createAdvertisement(data: InsertAdvertisement): Promise<Advertisement> {
    const result = await db
      .insert(advertisements)
      .values(data)
      .returning();

    return result[0];
  }

  async updateAdvertisement(id: number, data: Partial<InsertAdvertisement>): Promise<Advertisement | undefined> {
    const result = await db
      .update(advertisements)
      .set(data)
      .where(eq(advertisements.id, id))
      .returning();

    return result[0];
  }

  async deleteAdvertisement(id: number): Promise<boolean> {
    const result = await db
      .delete(advertisements)
      .where(eq(advertisements.id, id))
      .returning();

    return result.length > 0;
  }
}
