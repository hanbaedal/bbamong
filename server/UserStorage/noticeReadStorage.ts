import type { Notice } from "@shared/schema";
import { isPriorityNoticeTag } from "@shared/noticeBanner";
import { NoticeModel, NoticeReadModel } from "./db";
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
  return TAG_PRIORITY[tag] ?? (isPriorityNoticeTag(tag) ? 3 : 1);
}

type NoticeReadDoc = {
  noticeId: number;
  dismissedAt?: Date;
  readAt?: Date | null;
  gameBannerDismissedAt?: Date | null;
};

function isGameBannerDismissed(doc: NoticeReadDoc): boolean {
  if (doc.gameBannerDismissedAt) return true;
  // legacy: dismiss API가 read/game 구분 전 — dismissedAt만 있으면 게임 배너 숨김으로 간주
  if (doc.dismissedAt && !doc.readAt) return true;
  return false;
}

export class NoticeReadStorage {
  async getNoticeReadMap(userId: string): Promise<Map<number, NoticeReadDoc>> {
    const docs = (await NoticeReadModel.find({ userId }).lean()) as NoticeReadDoc[];
    return new Map(docs.map((d) => [d.noticeId, d]));
  }

  async dismissNotice(
    userId: string,
    noticeId: number,
    kind: "game" | "read" = "game",
  ): Promise<void> {
    const now = new Date();
    if (kind === "read") {
      await NoticeReadModel.updateOne(
        { userId, noticeId },
        { $set: { readAt: now } },
        { upsert: true },
      );
      return;
    }

    await NoticeReadModel.updateOne(
      { userId, noticeId },
      { $set: { gameBannerDismissedAt: now, dismissedAt: now } },
      { upsert: true },
    );
  }

  async getLatestUnreadNotice(userId: string): Promise<Notice | null> {
    const readMap = await this.getNoticeReadMap(userId);
    const notices = (await NoticeModel.find(PPAMONG_REVENUE_MONGO_FILTER)
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean()) as Notice[];

    const candidates = notices.filter((n) => {
      const read = readMap.get(n.id);
      if (!read) return true;
      return !isGameBannerDismissed(read);
    });

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      const p = tagPriority(b.tag) - tagPriority(a.tag);
      if (p !== 0) return p;
      if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return candidates[0] ?? null;
  }
}

export const noticeReadStorage = new NoticeReadStorage();
