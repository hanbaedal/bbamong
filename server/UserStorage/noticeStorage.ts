import { NoticeModel, mongoose, getNextSequence } from "./db";
import type { Notice, InsertNotice } from "@shared/schema";

export class NoticeStorage {
  async createNotice(notice: InsertNotice): Promise<Notice> {
    const id = await getNextSequence("notice");
    const doc = await NoticeModel.create({ id, ...notice });
    return doc.toObject() as Notice;
  }

  async getAllNotices(): Promise<Notice[]> {
    const docs = await NoticeModel.find()
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();
    return docs as Notice[];
  }

  async getNotice(id: number): Promise<Notice | undefined> {
    const doc = await NoticeModel.findOne({ id }).lean();
    return doc ? (doc as Notice) : undefined;
  }

  async updateNotice(id: number, data: Partial<InsertNotice>): Promise<Notice | undefined> {
    const doc = await NoticeModel.findOneAndUpdate(
      { id },
      { ...data, updatedAt: new Date() },
      { new: true },
    ).lean();
    return doc ? (doc as Notice) : undefined;
  }

  async deleteNotice(id: number): Promise<void> {
    await NoticeModel.deleteOne({ id });
  }

  async updateNoticeOrders(updates: { id: number; displayOrder: number }[]): Promise<void> {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      for (const update of updates) {
        await NoticeModel.updateOne(
          { id: update.id },
          { displayOrder: update.displayOrder },
          { session },
        );
      }
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getMaxDisplayOrder(): Promise<number> {
    const result = await NoticeModel.aggregate<{ maxOrder: number }>([
      { $group: { _id: null, maxOrder: { $max: "$displayOrder" } } },
    ]);
    return result[0]?.maxOrder ?? -1;
  }
}

export const noticeStorage = new NoticeStorage();
