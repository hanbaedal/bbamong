import { MallPurchaseOrderModel, MallSupplierModel, getNextSequence } from "./db";
import { mallInventoryStorage } from "./mallInventoryStorage";
import type { MallPurchaseOrderStatus } from "@shared/mallOps";

export interface MallSupplier {
  id: number;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  memo: string;
  createdAt: Date;
}

export interface MallPurchaseLine {
  productId: number;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  receivedQuantity: number;
  unitCost: number;
}

export interface MallPurchaseOrder {
  id: number;
  supplierId: number;
  supplierName: string;
  status: MallPurchaseOrderStatus;
  lines: MallPurchaseLine[];
  memo: string;
  orderedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class MallPurchaseStorage {
  async listSuppliers(): Promise<MallSupplier[]> {
    const docs = await MallSupplierModel.find().sort({ name: 1 }).lean();
    return docs as MallSupplier[];
  }

  async createSupplier(data: {
    name: string;
    contactName?: string;
    phone?: string;
    email?: string;
    memo?: string;
  }): Promise<MallSupplier> {
    const id = await getNextSequence("mallSupplier");
    const doc = await MallSupplierModel.create({
      id,
      name: data.name.trim(),
      contactName: data.contactName ?? "",
      phone: data.phone ?? "",
      email: data.email ?? "",
      memo: data.memo ?? "",
    });
    return doc.toObject() as MallSupplier;
  }

  async updateSupplier(
    id: number,
    data: Partial<Omit<MallSupplier, "id" | "createdAt">>,
  ): Promise<MallSupplier | undefined> {
    const doc = await MallSupplierModel.findOneAndUpdate({ id }, data, { new: true }).lean();
    return doc ? (doc as MallSupplier) : undefined;
  }

  async deleteSupplier(id: number): Promise<void> {
    await MallSupplierModel.deleteOne({ id });
  }

  async listPurchaseOrders(): Promise<MallPurchaseOrder[]> {
    const docs = await MallPurchaseOrderModel.find().sort({ createdAt: -1 }).lean();
    return docs as MallPurchaseOrder[];
  }

  async createPurchaseOrder(data: {
    supplierId: number;
    lines: MallPurchaseLine[];
    memo?: string;
    status?: MallPurchaseOrderStatus;
  }): Promise<MallPurchaseOrder> {
    const supplier = await MallSupplierModel.findOne({ id: data.supplierId }).lean();
    if (!supplier) throw new Error("매입처를 찾을 수 없습니다.");
    const id = await getNextSequence("mallPurchaseOrder");
    const now = new Date();
    const doc = await MallPurchaseOrderModel.create({
      id,
      supplierId: data.supplierId,
      supplierName: supplier.name,
      status: data.status ?? "draft",
      lines: data.lines,
      memo: data.memo ?? "",
      orderedAt: data.status === "ordered" ? now : undefined,
      createdAt: now,
      updatedAt: now,
    });
    return doc.toObject() as MallPurchaseOrder;
  }

  async updatePurchaseOrderStatus(
    id: number,
    status: MallPurchaseOrderStatus,
  ): Promise<MallPurchaseOrder | undefined> {
    const update: Record<string, unknown> = { status, updatedAt: new Date() };
    if (status === "ordered") update.orderedAt = new Date();
    const doc = await MallPurchaseOrderModel.findOneAndUpdate({ id }, update, { new: true }).lean();
    return doc ? (doc as MallPurchaseOrder) : undefined;
  }

  async receivePurchaseLine(
    orderId: number,
    lineIndex: number,
    quantity: number,
    warehouseId: number,
    locationId?: number,
  ): Promise<MallPurchaseOrder | undefined> {
    const order = await MallPurchaseOrderModel.findOne({ id: orderId });
    if (!order) return undefined;
    const lines = order.lines as MallPurchaseLine[];
    const line = lines[lineIndex];
    if (!line) throw new Error("발주 품목을 찾을 수 없습니다.");

    const remaining = line.quantity - (line.receivedQuantity ?? 0);
    if (quantity <= 0 || quantity > remaining) {
      throw new Error(`입고 수량은 1~${remaining} 사이여야 합니다.`);
    }

    await mallInventoryStorage.receiveStock({
      warehouseId,
      locationId,
      productId: line.productId,
      color: line.color,
      size: line.size,
      quantity,
      referenceId: orderId,
      memo: `구매입고 #${orderId}`,
    });

    line.receivedQuantity = (line.receivedQuantity ?? 0) + quantity;
    order.set("lines", lines);
    const allReceived = lines.every((l) => (l.receivedQuantity ?? 0) >= l.quantity);
    const anyReceived = lines.some((l) => (l.receivedQuantity ?? 0) > 0);
    order.status = allReceived ? "received" : anyReceived ? "partial" : order.status;
    order.updatedAt = new Date();
    await order.save();
    return order.toObject() as MallPurchaseOrder;
  }
}

export const mallPurchaseStorage = new MallPurchaseStorage();
