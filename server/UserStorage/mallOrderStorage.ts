import { MallOrderModel, getNextSequence } from "./db";
import type { MallOrderStatus } from "@shared/mallOps";
import { normalizeMallOrderStatus } from "@shared/mallOps";

export interface MallOrderItem {
  productId: number;
  productName: string;
  priceAmount: number;
  quantity: number;
  imageUrl: string;
  color?: string;
  size?: string;
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
  status: MallOrderStatus | string;
  courierCompany: string;
  trackingNumber: string;
  shippedAt?: Date;
  stockRestored: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function mapOrder(doc: Record<string, unknown>): MallOrder {
  return {
    ...(doc as unknown as MallOrder),
    status: normalizeMallOrderStatus(String(doc.status ?? "pending")),
  };
}

export class MallOrderStorage {
  async create(data: Omit<MallOrder, "id" | "createdAt" | "updatedAt" | "stockRestored">): Promise<MallOrder> {
    const id = await getNextSequence("mallOrder");
    const now = new Date();
    const doc = await MallOrderModel.create({
      id,
      ...data,
      status: normalizeMallOrderStatus(String(data.status ?? "pending")),
      courierCompany: data.courierCompany ?? "",
      trackingNumber: data.trackingNumber ?? "",
      stockRestored: false,
      createdAt: now,
      updatedAt: now,
    });
    return mapOrder(doc.toObject() as unknown as Record<string, unknown>);
  }

  async listForAdmin(status?: string): Promise<MallOrder[]> {
    const filter: Record<string, unknown> = {};
    if (status && status !== "all") {
      if (status === "preparing") {
        filter.status = { $in: ["preparing", "confirmed"] };
      } else {
        filter.status = status;
      }
    }
    const docs = await MallOrderModel.find(filter).sort({ createdAt: -1 }).lean();
    return docs.map((d) => mapOrder(d as Record<string, unknown>));
  }

  async listForUser(userId: string): Promise<MallOrder[]> {
    const docs = await MallOrderModel.find({ userId }).sort({ createdAt: -1 }).lean();
    return docs.map((d) => mapOrder(d as Record<string, unknown>));
  }

  async getById(id: number): Promise<MallOrder | undefined> {
    const doc = await MallOrderModel.findOne({ id }).lean();
    return doc ? mapOrder(doc as Record<string, unknown>) : undefined;
  }

  async updateStatus(id: number, status: MallOrderStatus | string): Promise<MallOrder | undefined> {
    const doc = await MallOrderModel.findOneAndUpdate(
      { id },
      { status, updatedAt: new Date() },
      { new: true },
    ).lean();
    return doc ? mapOrder(doc as Record<string, unknown>) : undefined;
  }

  async updateOrder(
    id: number,
    data: {
      status?: MallOrderStatus | string;
      courierCompany?: string;
      trackingNumber?: string;
      shippedAt?: Date;
      stockRestored?: boolean;
    },
  ): Promise<MallOrder | undefined> {
    const doc = await MallOrderModel.findOneAndUpdate(
      { id },
      { ...data, updatedAt: new Date() },
      { new: true },
    ).lean();
    return doc ? mapOrder(doc as Record<string, unknown>) : undefined;
  }

  async listForSales(from: Date, to: Date): Promise<MallOrder[]> {
    const docs = await MallOrderModel.find({
      status: { $nin: ["cancelled"] },
      createdAt: { $gte: from, $lte: to },
    })
      .sort({ createdAt: -1 })
      .lean();
    return docs.map((d) => mapOrder(d as Record<string, unknown>));
  }
}

export const mallOrderStorage = new MallOrderStorage();
