import { db } from "./db";
import { ebooks, ebookPurchases } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import type { Ebook, InsertEbook, EbookPurchase, InsertEbookPurchase } from "@shared/schema";

export class EbookStorage {
  // 모든 전자책 조회
  async getAllEbooks(): Promise<Ebook[]> {
    const result = await db
      .select()
      .from(ebooks)
      .orderBy(desc(ebooks.createdAt));
    
    return result;
  }

  // 특정 전자책 조회
  async getEbook(id: number): Promise<Ebook | undefined> {
    const result = await db
      .select()
      .from(ebooks)
      .where(eq(ebooks.id, id));
    
    return result[0];
  }

  // 전자책 생성 (관리자용)
  async createEbook(ebook: InsertEbook): Promise<Ebook> {
    const result = await db
      .insert(ebooks)
      .values(ebook)
      .returning();
    
    return result[0];
  }

  // 특정 사용자의 전자책 구매내역 조회
  async getUserPurchases(userId: string): Promise<Array<EbookPurchase & { ebook: Ebook }>> {
    const result = await db
      .select({
        id: ebookPurchases.id,
        userId: ebookPurchases.userId,
        ebookId: ebookPurchases.ebookId,
        purchasedAt: ebookPurchases.purchasedAt,
        ebook: ebooks,
      })
      .from(ebookPurchases)
      .leftJoin(ebooks, eq(ebookPurchases.ebookId, ebooks.id))
      .where(eq(ebookPurchases.userId, userId))
      .orderBy(desc(ebookPurchases.purchasedAt));
    
    return result.map(row => ({
      id: row.id,
      userId: row.userId,
      ebookId: row.ebookId,
      purchasedAt: row.purchasedAt,
      ebook: row.ebook!,
    }));
  }

  // 전자책 구매 여부 확인
  async hasPurchased(userId: string, ebookId: number): Promise<boolean> {
    const result = await db
      .select()
      .from(ebookPurchases)
      .where(
        and(
          eq(ebookPurchases.userId, userId),
          eq(ebookPurchases.ebookId, ebookId)
        )
      )
      .limit(1);
    
    return result.length > 0;
  }

  // 전자책 구매
  async purchaseEbook(purchase: InsertEbookPurchase): Promise<EbookPurchase> {
    const result = await db
      .insert(ebookPurchases)
      .values(purchase)
      .returning();
    
    return result[0];
  }
}
