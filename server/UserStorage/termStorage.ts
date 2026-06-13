import { db } from "./db";
import { terms } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import type { Term, InsertTerm } from "@shared/schema";

export class TermStorage {
  async createTerm(term: InsertTerm): Promise<Term> {
    const result = await db.insert(terms).values(term).returning();
    return result[0];
  }

  async getTermsByType(type: string): Promise<Term[]> {
    return await db.select().from(terms).where(eq(terms.type, type));
  }

  async getTermByType(type: string): Promise<Term | undefined> {
    const result = await db.select().from(terms).where(eq(terms.type, type));
    return result[0];
  }

  async getTerm(id: number): Promise<Term | undefined> {
    const result = await db.select().from(terms).where(eq(terms.id, id));
    return result[0];
  }

  async createOrUpdateTermByType(data: InsertTerm): Promise<Term> {
    const existing = await this.getTermByType(data.type);

    if (existing) {
      const result = await db
        .update(terms)
        .set({ 
          title: data.title, 
          content: data.content,
          updatedAt: sql`now()` 
        })
        .where(eq(terms.type, data.type))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(terms).values(data).returning();
      return result[0];
    }
  }

  async updateTerm(
    id: number,
    data: Partial<InsertTerm>
  ): Promise<Term | undefined> {
    const result = await db
      .update(terms)
      .set({ ...data, updatedAt: sql`now()` })
      .where(eq(terms.id, id))
      .returning();
    return result[0];
  }

  async deleteTerm(id: number): Promise<void> {
    await db.delete(terms).where(eq(terms.id, id));
  }
}

export const termStorage = new TermStorage();
