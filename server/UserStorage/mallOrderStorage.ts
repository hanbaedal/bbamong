import { MallOrderModel, getNextSequence } from "./db";

export interface MallOrderItem {
  productId: number;
  productName: string;
  priceAmount: number;
  quantity: number;
  imageUrl: string;
}

export interface MallOrder {
  id: number;
  userId: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  memo: string;
  items: MallOrderItem[];
  totalAmount: number;
  status: "pending" | "confirmed" | "shipped" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}

export class MallOrderStorage {
  async create(data: Omit<MallOrder, "id" | "createdAt" | "updatedAt">): Promise<MallOrder> {
    const id = await getNextSequence("mallOrder");
    const now = new Date();
    const doc = await MallOrderModel.create({
      id,
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    return doc.toObject() as MallOrder;
  }

  async listForAdmin(status?: string): Promise<MallOrder[]> {
    const filter: Record<string, unknown> = {};
    if (status && status !== "all") {
      filter.status = status;
    }
    const docs = await MallOrderModel.find(filter).sort({ createdAt: -1 }).lean();
    return docs as MallOrder[];
  }

  async listForUser(userId: string): Promise<MallOrder[]> {
    const docs = await MallOrderModel.find({ userId }).sort({ createdAt: -1 }).lean();
    return docs as MallOrder[];
  }

  async getById(id: number): Promise<MallOrder | undefined> {
    const doc = await MallOrderModel.findOne({ id }).lean();
    return doc as MallOrder | undefined;
  }

  async updateStatus(
    id: number,
    status: MallOrder["status"],
  ): Promise<MallOrder | undefined> {
    const doc = await MallOrderModel.findOneAndUpdate(
      { id },
      { status, updatedAt: new Date() },
      { new: true },
    ).lean();
    return doc as MallOrder | undefined;
  }
}

export const mallOrderStorage = new MallOrderStorage();
