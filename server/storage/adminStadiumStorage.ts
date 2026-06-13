import { db } from "../UserStorage/db";
import { stadiums, matches, predictions, roundStatistics, type Stadium, type InsertStadium } from "@shared/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";

export interface IAdminStadiumStorage {
  getAllStadiums(): Promise<Stadium[]>;
  createStadium(stadium: InsertStadium): Promise<Stadium>;
  updateStadium(id: number, stadium: InsertStadium): Promise<Stadium | undefined>;
  deleteStadium(id: number): Promise<void>;
}

export class AdminStadiumStorage implements IAdminStadiumStorage {
  async getAllStadiums(): Promise<Stadium[]> {
    const result = await db.execute<{ id: number; name: string; createdAt: Date }>(sql`
      SELECT s.id, s.name, s.created_at as "createdAt"
      FROM stadiums s
      ORDER BY s.created_at DESC
    `);
    return result.map(row => ({
      id: row.id,
      name: row.name,
      createdAt: new Date(row.createdAt)
    }));
  }

  async createStadium(stadium: InsertStadium): Promise<Stadium> {
    const [result] = await db.insert(stadiums).values(stadium).returning().execute();
    return result;
  }

  async updateStadium(id: number, stadium: InsertStadium): Promise<Stadium | undefined> {
    const [result] = await db
      .update(stadiums)
      .set(stadium)
      .where(eq(stadiums.id, id))
      .returning()
      .execute();
    return result;
  }

  async getMatchCountByStadium(id: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(matches).where(eq(matches.stadiumId, id));
    return Number(result[0]?.count ?? 0);
  }

  async deleteStadium(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      const relatedMatches = await tx.select({ id: matches.id }).from(matches).where(eq(matches.stadiumId, id));
      const matchIds = relatedMatches.map(m => m.id);
      
      if (matchIds.length > 0) {
        await tx.delete(predictions).where(inArray(predictions.matchId, matchIds)).execute();
        await tx.delete(roundStatistics).where(inArray(roundStatistics.matchId, matchIds)).execute();
        await tx.delete(matches).where(eq(matches.stadiumId, id)).execute();
      }
      
      await tx.delete(stadiums).where(eq(stadiums.id, id)).execute();
    });
  }
}

export const adminStadiumStorage = new AdminStadiumStorage();
