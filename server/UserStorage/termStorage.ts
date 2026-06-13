import { TermModel, getNextSequence } from "./db";
import type { Term, InsertTerm } from "@shared/schema";

export class TermStorage {
  async createTerm(term: InsertTerm): Promise<Term> {
    const id = await getNextSequence("term");
    const doc = await TermModel.create({ id, ...term });
    return doc.toObject() as Term;
  }

  async getTermsByType(type: string): Promise<Term[]> {
    const docs = await TermModel.find({ type }).lean();
    return docs as Term[];
  }

  async getTermByType(type: string): Promise<Term | undefined> {
    const doc = await TermModel.findOne({ type }).lean();
    return doc ? (doc as Term) : undefined;
  }

  async getTerm(id: number): Promise<Term | undefined> {
    const doc = await TermModel.findOne({ id }).lean();
    return doc ? (doc as Term) : undefined;
  }

  async createOrUpdateTermByType(data: InsertTerm): Promise<Term> {
    const existing = await this.getTermByType(data.type);

    if (existing) {
      const doc = await TermModel.findOneAndUpdate(
        { type: data.type },
        { title: data.title, content: data.content, updatedAt: new Date() },
        { new: true },
      ).lean();
      return doc as Term;
    }

    const id = await getNextSequence("term");
    const doc = await TermModel.create({ id, ...data });
    return doc.toObject() as Term;
  }

  async updateTerm(id: number, data: Partial<InsertTerm>): Promise<Term | undefined> {
    const doc = await TermModel.findOneAndUpdate(
      { id },
      { ...data, updatedAt: new Date() },
      { new: true },
    ).lean();
    return doc ? (doc as Term) : undefined;
  }

  async deleteTerm(id: number): Promise<void> {
    await TermModel.deleteOne({ id });
  }
}

export const termStorage = new TermStorage();
