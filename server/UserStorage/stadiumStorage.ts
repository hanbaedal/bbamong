import { StadiumModel, getNextSequence } from "./db";
import type { Stadium, InsertStadium } from "@shared/schema";

export class StadiumStorage {
  async getAllStadiums(): Promise<Stadium[]> {
    const docs = await StadiumModel.find().lean();
    return docs as Stadium[];
  }

  async getStadium(id: number): Promise<Stadium | undefined> {
    const doc = await StadiumModel.findOne({ id }).lean();
    return doc ? (doc as Stadium) : undefined;
  }

  async createStadium(stadium: InsertStadium): Promise<Stadium> {
    const id = await getNextSequence("stadium");
    const doc = await StadiumModel.create({ id, ...stadium });
    return doc.toObject() as Stadium;
  }

  async updateStadium(id: number, stadium: InsertStadium): Promise<Stadium | undefined> {
    const doc = await StadiumModel.findOneAndUpdate({ id }, stadium, { new: true }).lean();
    return doc ? (doc as Stadium) : undefined;
  }

  async deleteStadium(id: number): Promise<void> {
    await StadiumModel.deleteOne({ id });
  }
}

export const stadiumStorage = new StadiumStorage();
