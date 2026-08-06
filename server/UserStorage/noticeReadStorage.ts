import { NoticeModel, NoticeReadModel } from "./db";
import type { Notice } from "@shared/schema";
import { PPAMONG_REVENUE_MONGO_FILTER } from "../utils/revenuePlatform";

const TAG_PRIORITY: Record<string, number> = {
  긴급: 4,
  중요: 3,
  우선: 3,
  필독: 3,
  노출: 2,
  보통: 1,
};

function tagPriority(tag: string): number {
  return TAG_PRIORITY[tag] ?? 1;
}

export class NoticeReadStorage {
  async getDismissedNoticeIds(userId: string): Promise<Set<number>> {
    const docs = await NoticeReadModel.find({ userId }).select("noticeId").lean();
    return new Set(docs.map((d) => d.noticeId));
  }

  async dismissNotice(userId: string, noticeId: number): Promise<void> {
    await NoticeReadModel.updateOne(
      { userId, noticeId },
      { $set: { dismissedAt: new Date() } },
      { upsert: true },
    );
  }

  async getLatestUnreadNotice(userId: string): Promise<Notice | null> {
    const dismissed = await this.getDismissedNoticeIds(userId);
    const notices = (await NoticeModel.find(PPAMONG_REVENUE_MONGO_FILTER)
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean()) as Notice[];

    const unread = notices.filter((n) => !dismissed.has(n.id));
    if (unread.length === 0) return null;

    unread.sort((a, b) => {
      const p = tagPriority(b.tag) - tagPriority(a.tag);
      if (p !== 0) return p;
      if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return unread[0] ?? null;
  }
}

export const noticeReadStorage = new NoticeReadStorage();
