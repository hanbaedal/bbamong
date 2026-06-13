import { db } from "./db";
import { stadiums } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Stadium, InsertStadium } from "@shared/schema";

export class StadiumStorage {
  async getAllStadiums(): Promise<Stadium[]> {
    return await db.select().from(stadiums);
  }

  async getStadium(id: number): Promise<Stadium | undefined> {
    const result = await db.select().from(stadiums).where(eq(stadiums.id, id));
    return result[0];
  }

  async createStadium(stadium: InsertStadium): Promise<Stadium> {
    const result = await db.insert(stadiums).values(stadium).returning();
    return result[0];
  }

  async updateStadium(id: number, stadium: InsertStadium): Promise<Stadium | undefined> {
    const result = await db.update(stadiums).set(stadium).where(eq(stadiums.id, id)).returning();
    return result[0];
  }

  async deleteStadium(id: number): Promise<void> {
    await db.delete(stadiums).where(eq(stadiums.id, id));
  }
}

export const stadiumStorage = new StadiumStorage();
