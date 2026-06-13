import { FaqModel, getNextSequence } from "./db";
import type { Faq, InsertFaq } from "@shared/schema";

export class FaqStorage {
  async createFaq(faq: InsertFaq): Promise<Faq> {
    const id = await getNextSequence("faq");
    const doc = await FaqModel.create({ id, ...faq });
    return doc.toObject() as Faq;
  }

  async getAllFaqs(): Promise<Faq[]> {
    const docs = await FaqModel.find().sort({ order: 1 }).lean();
    return docs as Faq[];
  }

  async getFaq(id: number): Promise<Faq | undefined> {
    const doc = await FaqModel.findOne({ id }).lean();
    return doc ? (doc as Faq) : undefined;
  }

  async updateFaq(id: number, data: Partial<InsertFaq>): Promise<Faq | undefined> {
    const doc = await FaqModel.findOneAndUpdate({ id }, data, { new: true }).lean();
    return doc ? (doc as Faq) : undefined;
  }

  async deleteFaq(id: number): Promise<void> {
    await FaqModel.deleteOne({ id });
  }
}

export const faqStorage = new FaqStorage();
