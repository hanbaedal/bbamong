import { InquiryModel, UserModel, getNextSequence } from "./db";
import type { Inquiry, InsertInquiry } from "@shared/schema";
import {
  BADMINTON9_REVENUE_MONGO_FILTER,
  PPAMONG_REVENUE_MONGO_FILTER,
  REVENUE_SOURCE_PPAMONG,
  revenuePlatformFilter,
  type RevenuePlatform,
} from "../utils/revenuePlatform";

import {
  PPAMONG_OFFICIAL_AUTHOR_ID,
  PPAMONG_OFFICIAL_DISPLAY_NAME,
} from "../utils/ppamongOfficialContent";

export interface InquiryListResponse {
  data: Array<
    Inquiry & {
      userName: string;
      userUsername: string;
    }
  >;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  pendingCount: number;
  resolvedCount: number;
  platform: RevenuePlatform;
  counts: { ppamong: number; badminton9: number };
}

function statusFilterFromTab(status?: string): Record<string, string> | undefined {
  if (status === "답변 대기") return { status: "pending" };
  if (status === "답변 완료") return { status: "resolved" };
  return undefined;
}

export class InquiryStorage {
  /** 앱 문의 FAQ — 빠몽 운영자 게시글만 */
  async getOfficialInquiries(): Promise<
    Array<Inquiry & { category: string; title: string; content: string; response: string | null }>
  > {
    const rows = await InquiryModel.find({
      isOfficial: true,
      ...PPAMONG_REVENUE_MONGO_FILTER,
      status: "resolved",
    })
      .sort({ id: -1 })
      .lean();
    return rows as Inquiry[];
  }

  async isOfficialPpamongInquiry(id: number): Promise<boolean> {
    const row = await InquiryModel.findOne({
      id,
      isOfficial: true,
      ...PPAMONG_REVENUE_MONGO_FILTER,
    })
      .select("id")
      .lean();
    return !!row;
  }

  async createOfficialInquiry(data: {
    category: string;
    title: string;
    content: string;
    response: string;
  }): Promise<Inquiry> {
    const id = await getNextSequence("inquiry");
    const doc = await InquiryModel.create({
      id,
      userId: PPAMONG_OFFICIAL_AUTHOR_ID,
      category: data.category,
      title: data.title,
      content: data.content,
      response: data.response,
      status: "resolved",
      dataSource: REVENUE_SOURCE_PPAMONG,
      isOfficial: true,
    });
    return doc.toObject() as Inquiry;
  }

  async updateOfficialInquiry(
    id: number,
    data: Partial<{ category: string; title: string; content: string; response: string }>,
  ): Promise<Inquiry | undefined> {
    const doc = await InquiryModel.findOneAndUpdate(
      { id, isOfficial: true, ...PPAMONG_REVENUE_MONGO_FILTER },
      data,
      { new: true },
    ).lean();
    return doc ? (doc as Inquiry) : undefined;
  }

  async deleteOfficialInquiry(id: number): Promise<boolean> {
    const result = await InquiryModel.deleteOne({
      id,
      isOfficial: true,
      ...PPAMONG_REVENUE_MONGO_FILTER,
    });
    return (result.deletedCount ?? 0) > 0;
  }

  async createInquiry(inquiry: InsertInquiry): Promise<Inquiry> {
    const id = await getNextSequence("inquiry");
    const doc = await InquiryModel.create({
      id,
      ...inquiry,
      dataSource: REVENUE_SOURCE_PPAMONG,
    });
    return doc.toObject() as Inquiry;
  }

  async getInquiriesByUser(userId: string): Promise<Array<Inquiry & { userName: string }>> {
    const inquiries = await InquiryModel.find({
      userId,
      ...PPAMONG_REVENUE_MONGO_FILTER,
    })
      .sort({ id: -1 })
      .lean();
    const results: Array<Inquiry & { userName: string }> = [];

    for (const row of inquiries) {
      const user = await UserModel.findOne({ id: row.userId }).select("name").lean();
      results.push({
        ...(row as Inquiry),
        userName: user?.name || "Unknown",
      });
    }
    return results;
  }

  async getInquiry(id: number): Promise<(Inquiry & { userName: string }) | undefined> {
    const inquiry = await InquiryModel.findOne({ id }).lean();
    if (!inquiry) return undefined;

    const user = await UserModel.findOne({ id: inquiry.userId }).select("name").lean();
    return {
      ...(inquiry as Inquiry),
      userName: user?.name || "Unknown",
    };
  }

  async updateInquiryStatus(
    id: number,
    status: string,
    response?: string,
  ): Promise<Inquiry | undefined> {
    const updateData: Record<string, unknown> = { status };
    if (response !== undefined) {
      updateData.response = response;
    }

    const doc = await InquiryModel.findOneAndUpdate({ id }, updateData, { new: true }).lean();
    return doc ? (doc as Inquiry) : undefined;
  }

  async deleteInquiry(id: number): Promise<void> {
    await InquiryModel.deleteOne({ id });
  }

  async updateInquiryByOwner(
    id: number,
    userId: string,
    data: Partial<Pick<InsertInquiry, "category" | "title" | "content">>,
  ): Promise<{ success: boolean; message: string; inquiry?: Inquiry }> {
    const inquiry = await InquiryModel.findOne({ id, ...PPAMONG_REVENUE_MONGO_FILTER }).lean();
    if (!inquiry) return { success: false, message: "문의를 찾을 수 없습니다." };
    if (inquiry.userId !== userId) return { success: false, message: "본인 문의만 수정할 수 있습니다." };
    if (inquiry.status !== "pending") {
      return { success: false, message: "답변 대기 중인 문의만 수정할 수 있습니다." };
    }

    const doc = await InquiryModel.findOneAndUpdate({ id }, data, { new: true }).lean();
    return {
      success: true,
      message: "문의가 수정되었습니다.",
      inquiry: doc as Inquiry,
    };
  }

  async deleteInquiryByOwner(
    id: number,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const inquiry = await InquiryModel.findOne({ id, ...PPAMONG_REVENUE_MONGO_FILTER }).lean();
    if (!inquiry) return { success: false, message: "문의를 찾을 수 없습니다." };
    if (inquiry.userId !== userId) return { success: false, message: "본인 문의만 삭제할 수 있습니다." };
    if (inquiry.status !== "pending") {
      return { success: false, message: "답변 대기 중인 문의만 삭제할 수 있습니다." };
    }

    await InquiryModel.deleteOne({ id });
    return { success: true, message: "문의가 삭제되었습니다." };
  }

  async getAllInquiries(
    status?: string,
    page: number = 1,
    limit: number = 8,
    platform: RevenuePlatform = "ppamong",
  ): Promise<InquiryListResponse> {
    const statusFilter = statusFilterFromTab(status);
    const platformFilter = revenuePlatformFilter(platform);
    const filter = statusFilter ? { ...platformFilter, ...statusFilter } : platformFilter;
    const offset = (page - 1) * limit;

    const [total, inquiries, pendingCount, resolvedCount, ppamongCount, badminton9Count] =
      await Promise.all([
        InquiryModel.countDocuments(filter),
        InquiryModel.find(filter).sort({ id: -1 }).skip(offset).limit(limit).lean(),
        InquiryModel.countDocuments({ ...platformFilter, status: "pending" }),
        InquiryModel.countDocuments({ ...platformFilter, status: "resolved" }),
        InquiryModel.countDocuments(PPAMONG_REVENUE_MONGO_FILTER),
        InquiryModel.countDocuments(BADMINTON9_REVENUE_MONGO_FILTER),
      ]);

    const totalPages = Math.ceil(total / limit);

    const data = await Promise.all(
      inquiries.map(async (row) => {
        const user = await UserModel.findOne({ id: row.userId }).select("name username").lean();
        return {
          ...(row as Inquiry),
          userName: user?.name || "Unknown",
          userUsername: user?.username || "Unknown",
        };
      }),
    );

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      pendingCount,
      resolvedCount,
      platform,
      counts: { ppamong: ppamongCount, badminton9: badminton9Count },
    };
  }
}

export const inquiryStorage = new InquiryStorage();
