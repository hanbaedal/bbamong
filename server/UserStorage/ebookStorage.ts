import { EbookModel, EbookPurchaseModel, getNextSequence } from "./db";
import type { Ebook, InsertEbook, EbookPurchase, InsertEbookPurchase } from "@shared/schema";

export class EbookStorage {
  async getAllEbooks(): Promise<Ebook[]> {
    const docs = await EbookModel.find().sort({ createdAt: -1 }).lean();
    return docs as Ebook[];
  }

  async getEbook(id: number): Promise<Ebook | undefined> {
    const doc = await EbookModel.findOne({ id }).lean();
    return doc ? (doc as Ebook) : undefined;
  }

  async createEbook(ebook: InsertEbook): Promise<Ebook> {
    const ebookId = await getNextSequence("ebook");
    const doc = await EbookModel.create({ id: ebookId, ...ebook });
    return doc.toObject() as Ebook;
  }

  async getUserPurchases(userId: string): Promise<Array<EbookPurchase & { ebook: Ebook }>> {
    const purchases = await EbookPurchaseModel.find({ userId })
      .sort({ purchasedAt: -1 })
      .lean();

    const results: Array<EbookPurchase & { ebook: Ebook }> = [];
    for (const purchase of purchases) {
      const ebook = await EbookModel.findOne({ id: purchase.ebookId }).lean();
      if (!ebook) continue;
      results.push({
        ...(purchase as EbookPurchase),
        ebook: ebook as Ebook,
      });
    }
    return results;
  }

  async hasPurchased(userId: string, ebookId: number): Promise<boolean> {
    const doc = await EbookPurchaseModel.findOne({ userId, ebookId }).lean();
    return !!doc;
  }

  async purchaseEbook(purchase: InsertEbookPurchase): Promise<EbookPurchase> {
    const id = await getNextSequence("ebookPurchase");
    const doc = await EbookPurchaseModel.create({ id, ...purchase });
    return doc.toObject() as EbookPurchase;
  }
}
