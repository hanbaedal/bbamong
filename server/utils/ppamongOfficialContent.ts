import {
  BADMINTON9_REVENUE_MONGO_FILTER,
  PPAMONG_REVENUE_MONGO_FILTER,
  REVENUE_SOURCE_PPAMONG,
  revenuePlatformFilter,
  type RevenuePlatform,
} from "./revenuePlatform";

/** 빠몽 앱 — 공지·게시판·문의 FAQ 등 운영자(빠봉) 전용 콘텐츠 */
export const PPAMONG_OFFICIAL_AUTHOR_ID = "ppamong-official";
export const PPAMONG_OFFICIAL_DISPLAY_NAME = "빠몽";

export { REVENUE_SOURCE_PPAMONG };

/** 빠몽 운영자 게시글·FAQ */
export function ppamongOfficialPostFilter(): Record<string, unknown> {
  return {
    ...PPAMONG_REVENUE_MONGO_FILTER,
    $or: [{ isOfficial: true }, { authorId: PPAMONG_OFFICIAL_AUTHOR_ID }],
  };
}

export function ppamongOfficialInquiryFilter(): Record<string, unknown> {
  return {
    ...PPAMONG_REVENUE_MONGO_FILTER,
    $or: [{ isOfficial: true }, { userId: PPAMONG_OFFICIAL_AUTHOR_ID }],
  };
}

/** 관리자 게시판 탭 — ppamong=공식, badminton9=PG 레거시(공지와 동일 dataSource) */
export function adminSupportPlatformFilter(platform: RevenuePlatform): Record<string, unknown> {
  if (platform === "ppamong") {
    return ppamongOfficialPostFilter();
  }
  return {
    ...BADMINTON9_REVENUE_MONGO_FILTER,
    isOfficial: { $ne: true },
  };
}

export function adminInquiryPlatformFilter(platform: RevenuePlatform): Record<string, unknown> {
  if (platform === "ppamong") {
    return ppamongOfficialInquiryFilter();
  }
  return {
    ...revenuePlatformFilter("badminton9"),
    isOfficial: { $ne: true },
  };
}

export async function countSupportPlatformPosts(): Promise<{ ppamong: number; badminton9: number }> {
  const { PostModel } = await import("../UserStorage/db");
  const [ppamong, badminton9] = await Promise.all([
    PostModel.countDocuments(ppamongOfficialPostFilter()),
    PostModel.countDocuments({
      ...BADMINTON9_REVENUE_MONGO_FILTER,
      isOfficial: { $ne: true },
    }),
  ]);
  return { ppamong, badminton9 };
}

export async function countSupportPlatformInquiries(): Promise<{ ppamong: number; badminton9: number }> {
  const { InquiryModel } = await import("../UserStorage/db");
  const [ppamong, badminton9] = await Promise.all([
    InquiryModel.countDocuments(ppamongOfficialInquiryFilter()),
    InquiryModel.countDocuments({
      ...BADMINTON9_REVENUE_MONGO_FILTER,
      isOfficial: { $ne: true },
    }),
  ]);
  return { ppamong, badminton9 };
}
