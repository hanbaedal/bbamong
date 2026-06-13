import { InquiryModel, UserModel, getNextSequence } from "./db";
import type { Inquiry, InsertInquiry } from "@shared/schema";

export class InquiryStorage {
  async createInquiry(inquiry: InsertInquiry): Promise<Inquiry> {
    const id = await getNextSequence("inquiry");
    const doc = await InquiryModel.create({ id, ...inquiry });
    return doc.toObject() as Inquiry;
  }

  async getInquiriesByUser(userId: string): Promise<Array<Inquiry & { userName: string }>> {
    const inquiries = await InquiryModel.find({ userId }).sort({ id: -1 }).lean();
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

  async getAllInquiries(status?: string, page: number = 1, limit: number = 8) {
    let statusFilter: Record<string, string> | undefined;
    if (status === "답변 대기") {
      statusFilter = { status: "pending" };
    } else if (status === "답변 완료") {
      statusFilter = { status: "resolved" };
    }

    const filter = statusFilter ?? {};
    const offset = (page - 1) * limit;

    const [total, inquiries, pendingCount, resolvedCount] = await Promise.all([
      InquiryModel.countDocuments(filter),
      InquiryModel.find(filter).sort({ id: -1 }).skip(offset).limit(limit).lean(),
      InquiryModel.countDocuments({ status: "pending" }),
      InquiryModel.countDocuments({ status: "resolved" }),
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
    };
  }
}

export const inquiryStorage = new InquiryStorage();
