import { ShopInquiryModel, getNextSequence } from "./db";

export interface ShopInquiry {
  id: number;
  productId: number;
  productName: string;
  customerName: string;
  phone: string;
  email: string;
  message: string;
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

  async updateStatus(id: number, status: "pending" | "done"): Promise<ShopInquiry | undefined> {
    const doc = await ShopInquiryModel.findOneAndUpdate(
      { id },
      { status, updatedAt: new Date() },
      { new: true },
    ).lean();
    return doc ? (doc as ShopInquiry) : undefined;
  }
}

export const shopInquiryStorage = new ShopInquiryStorage();
