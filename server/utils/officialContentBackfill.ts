import { InquiryModel, PostModel } from "../UserStorage/db";
import {
  PPAMONG_OFFICIAL_AUTHOR_ID,
  REVENUE_SOURCE_PPAMONG,
} from "./ppamongOfficialContent";

/** 기동 시 — 운영자 등록 글에 isOfficial·dataSource 보정 */
export async function backfillOfficialSupportContent(): Promise<{
  posts: number;
  inquiries: number;
}> {
  const [postByAuthor, postByFlag, inquiryByUser, inquiryByFlag] = await Promise.all([
    PostModel.updateMany(
      { authorId: PPAMONG_OFFICIAL_AUTHOR_ID },
      { $set: { isOfficial: true, dataSource: REVENUE_SOURCE_PPAMONG } },
    ),
    PostModel.updateMany(
      { isOfficial: true, $or: [{ dataSource: { $exists: false } }, { dataSource: null }, { dataSource: "" }] },
      { $set: { dataSource: REVENUE_SOURCE_PPAMONG } },
    ),
    InquiryModel.updateMany(
      { userId: PPAMONG_OFFICIAL_AUTHOR_ID },
      { $set: { isOfficial: true, dataSource: REVENUE_SOURCE_PPAMONG, status: "resolved" } },
    ),
    InquiryModel.updateMany(
      { isOfficial: true, $or: [{ dataSource: { $exists: false } }, { dataSource: null }, { dataSource: "" }] },
      { $set: { dataSource: REVENUE_SOURCE_PPAMONG } },
    ),
  ]);

  return {
    posts: (postByAuthor.modifiedCount ?? 0) + (postByFlag.modifiedCount ?? 0),
    inquiries: (inquiryByUser.modifiedCount ?? 0) + (inquiryByFlag.modifiedCount ?? 0),
  };
}
