import { ShopInquiryModel, getNextSequence } from "./db";

export interface ShopInquiry {
  id: number;
  productId: number;
  productName: string;
  customerName: string;
  phone: string;
  email: string;
  message: string;
  response: string;
  respondedAt?: Date;
  status: "pending" | "done";
  createdAt: Date;
  updatedAt: Date;
}

export class ShopInquiryStorage {
  async create(data: {
    productId: number;
    productName: string;
    customerName: string;
    phone: string;
    email: string;
    message: string;
  }): Promise<ShopInquiry> {
    const id = await getNextSequence("shopInquiry");
    const doc = await ShopInquiryModel.create({
      id,
      ...data,
      response: "",
      status: "pending",
    });
    return doc.toObject() as ShopInquiry;
  }

  async list(limit = 100): Promise<ShopInquiry[]> {
    const docs = await ShopInquiryModel.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return docs as ShopInquiry[];
  }

  async update(
    id: number,
    data: { status?: "pending" | "done"; response?: string },
  ): Promise<ShopInquiry | undefined> {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (data.response !== undefined) {
      patch.response = data.response;
      patch.respondedAt = new Date();
      patch.status = "done";
    } else if (data.status !== undefined) {
      patch.status = data.status;
    }

    const doc = await ShopInquiryModel.findOneAndUpdate({ id }, patch, { new: true }).lean();
    return doc ? (doc as ShopInquiry) : undefined;
  }
}

export const shopInquiryStorage = new ShopInquiryStorage();
