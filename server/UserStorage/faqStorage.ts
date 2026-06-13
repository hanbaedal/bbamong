import { db } from "./db";
import { faqs } from "@shared/schema";
import { eq, asc } from "drizzle-orm";
import type { Faq, InsertFaq } from "@shared/schema";

export class FaqStorage {
  async createFaq(faq: InsertFaq): Promise<Faq> {
    const result = await db.insert(faqs).values(faq).returning();
    return result[0];
  }

  async getAllFaqs(): Promise<Faq[]> {
    return await db.select().from(faqs).orderBy(asc(faqs.order));
  }

  async getFaq(id: number): Promise<Faq | undefined> {
    const result = await db.select().from(faqs).where(eq(faqs.id, id));
    return result[0];
  }

  async updateFaq(
    id: number,
    data: Partial<InsertFaq>
  ): Promise<Faq | undefined> {
    const result = await db
      .update(faqs)
      .set(data)
      .where(eq(faqs.id, id))
      .returning();
    return result[0];
  }

  async deleteFaq(id: number): Promise<void> {
    await db.delete(faqs).where(eq(faqs.id, id));
  }
}

export const faqStorage = new FaqStorage();
