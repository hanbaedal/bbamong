import { NoticeModel, mongoose, getNextSequence } from "./db";
import type { Notice, InsertNotice } from "@shared/schema";
import {
  BADMINTON9_REVENUE_MONGO_FILTER,
  PPAMONG_REVENUE_MONGO_FILTER,
  REVENUE_SOURCE_PPAMONG,
  revenuePlatformFilter,
  type RevenuePlatform,
} from "../utils/revenuePlatform";

export interface NoticeListResponse {
  notices: Notice[];
  platform: RevenuePlatform;
  counts: { ppamong: number; badminton9: number };
}

export class NoticeStorage {
  async createNotice(notice: InsertNotice): Promise<Notice> {
    const id = await getNextSequence("notice");
    const maxOrder = await this.getMaxDisplayOrderForPlatform("ppamong");
    const doc = await NoticeModel.create({
      id,
      ...notice,
      dataSource: REVENUE_SOURCE_PPAMONG,
      displayOrder: maxOrder + 1,
    });
    return doc.toObject() as Notice;
  }

  async getAllNotices(): Promise<Notice[]> {
    const docs = await NoticeModel.find()
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();
    return docs as Notice[];
  }

  async getNoticesForPlatform(platform: RevenuePlatform): Promise<NoticeListResponse> {
    const filter = revenuePlatformFilter(platform);
    const [notices, ppamongCount, badminton9Count] = await Promise.all([
      NoticeModel.find(filter).sort({ displayOrder: 1, createdAt: -1 }).lean(),
      NoticeModel.countDocuments(PPAMONG_REVENUE_MONGO_FILTER),
      NoticeModel.countDocuments(BADMINTON9_REVENUE_MONGO_FILTER),
    ]);
    return {
      notices: notices as Notice[],
      platform,
      counts: { ppamong: ppamongCount, badminton9: badminton9Count },
    };
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

  async getMaxDisplayOrderForPlatform(platform: RevenuePlatform): Promise<number> {
    const result = await NoticeModel.aggregate<{ maxOrder: number }>([
      { $match: revenuePlatformFilter(platform) },
      { $group: { _id: null, maxOrder: { $max: "$displayOrder" } } },
    ]);
    return result[0]?.maxOrder ?? -1;
  }
}

export const noticeStorage = new NoticeStorage();
