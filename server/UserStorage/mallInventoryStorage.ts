import {
  MallLocationModel,
  MallStockMovementModel,
  MallWarehouseModel,
  getNextSequence,
} from "./db";
import { goodsStorage } from "./goodsStorage";
import type { MallStockMovementType } from "@shared/mallOps";

export interface MallWarehouse {
  id: number;
  name: string;
  isDefault: boolean;
  createdAt: Date;
}

export interface MallLocation {
  id: number;
  warehouseId: number;
  code: string;
  description: string;
  createdAt: Date;
}

export interface MallStockMovement {
  id: number;
  warehouseId: number;
  locationId?: number;
  productId: number;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  movementType: string;
  referenceId?: number;
  memo: string;
  createdAt: Date;
}

export class MallInventoryStorage {
  async ensureDefaultWarehouse(): Promise<MallWarehouse> {
    const existing = await MallWarehouseModel.findOne({ isDefault: true }).lean();
    if (existing) return existing as MallWarehouse;
    const id = await getNextSequence("mallWarehouse");
    const doc = await MallWarehouseModel.create({
      id,
      name: "본사 창고",
      isDefault: true,
    });
    return doc.toObject() as MallWarehouse;
  }

  async listWarehouses(): Promise<MallWarehouse[]> {
    await this.ensureDefaultWarehouse();
    const docs = await MallWarehouseModel.find().sort({ id: 1 }).lean();
    return docs as MallWarehouse[];
  }

  async listLocations(warehouseId?: number): Promise<MallLocation[]> {
    const wh = await this.ensureDefaultWarehouse();
    const wid = warehouseId ?? wh.id;
    const docs = await MallLocationModel.find({ warehouseId: wid }).sort({ code: 1 }).lean();
    return docs as MallLocation[];
  }

  async createLocation(data: {
    warehouseId: number;
    code: string;
    description?: string;
  }): Promise<MallLocation> {
    const id = await getNextSequence("mallLocation");
    const doc = await MallLocationModel.create({
      id,
      warehouseId: data.warehouseId,
      code: data.code.trim(),
      description: data.description ?? "",
    });
    return doc.toObject() as MallLocation;
  }

  async recordMovement(data: {
    warehouseId: number;
    locationId?: number;
    productId: number;
    productName: string;
    color?: string;
    size?: string;
    quantity: number;
    movementType: MallStockMovementType;
    referenceId?: number;
    memo?: string;
  }): Promise<MallStockMovement> {
    const id = await getNextSequence("mallStockMovement");
    const doc = await MallStockMovementModel.create({
      id,
      warehouseId: data.warehouseId,
      locationId: data.locationId,
      productId: data.productId,
      productName: data.productName,
      color: data.color ?? "",
      size: data.size ?? "",
      quantity: data.quantity,
      movementType: data.movementType,
      referenceId: data.referenceId,
      memo: data.memo ?? "",
    });
    return doc.toObject() as MallStockMovement;
  }

  async receiveStock(data: {
    warehouseId: number;
    locationId?: number;
    productId: number;
    color?: string;
    size?: string;
    quantity: number;
    memo?: string;
    referenceId?: number;
  }): Promise<MallStockMovement> {
    const product = await goodsStorage.getProduct(data.productId);
    if (!product) throw new Error("상품을 찾을 수 없습니다.");
    await goodsStorage.incrementStock(data.productId, data.quantity, data.color, data.size);
    return this.recordMovement({
      warehouseId: data.warehouseId,
      locationId: data.locationId,
      productId: data.productId,
      productName: product.name,
      color: data.color,
      size: data.size,
      quantity: data.quantity,
      movementType: "receive",
      referenceId: data.referenceId,
      memo: data.memo ?? "입고",
    });
  }

  async adjustStock(data: {
    warehouseId: number;
    locationId?: number;
    productId: number;
    color?: string;
    size?: string;
    quantityDelta: number;
    memo?: string;
  }): Promise<MallStockMovement> {
    const product = await goodsStorage.getProduct(data.productId);
    if (!product) throw new Error("상품을 찾을 수 없습니다.");
    if (data.quantityDelta > 0) {
      await goodsStorage.incrementStock(data.productId, data.quantityDelta, data.color, data.size);
    } else if (data.quantityDelta < 0) {
      await goodsStorage.decrementStock(
        data.productId,
        Math.abs(data.quantityDelta),
        data.color,
        data.size,
      );
    }
    return this.recordMovement({
      warehouseId: data.warehouseId,
      locationId: data.locationId,
      productId: data.productId,
      productName: product.name,
      color: data.color,
      size: data.size,
      quantity: data.quantityDelta,
      movementType: "adjust",
      memo: data.memo ?? "재고 조정",
    });
  }

  async listMovements(limit = 100): Promise<MallStockMovement[]> {
    const docs = await MallStockMovementModel.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return docs as MallStockMovement[];
  }

  async listStockSummary(): Promise<
    Array<{
      productId: number;
      name: string;
      brand: string;
      categoryId: number;
      color: string;
      size: string;
      stock: number;
      reorderPoint: number;
      optimalStock: number;
      fulfillmentType: string;
    }>
  > {
    const products = await goodsStorage.listAllProducts(false);
    const rows: Array<{
      productId: number;
      name: string;
      brand: string;
      categoryId: number;
      color: string;
      size: string;
      stock: number;
      reorderPoint: number;
      optimalStock: number;
      fulfillmentType: string;
    }> = [];

    for (const p of products) {
      const variants = (p.variants ?? []).filter((v) => v.color || v.size);
      if (variants.length > 0) {
        for (const v of variants) {
          rows.push({
            productId: p.id,
            name: p.name,
            brand: p.brand ?? "",
            categoryId: p.categoryId,
            color: v.color,
            size: v.size,
            stock: v.stock,
            reorderPoint: p.reorderPoint ?? 0,
            optimalStock: p.optimalStock ?? 0,
            fulfillmentType: p.fulfillmentType ?? "stock",
          });
        }
      } else {
        rows.push({
          productId: p.id,
          name: p.name,
          brand: p.brand ?? "",
          categoryId: p.categoryId,
          color: "",
          size: "",
          stock: (p.stockQuantity ?? -1) >= 0 ? (p.stockQuantity ?? 0) : -1,
          reorderPoint: p.reorderPoint ?? 0,
          optimalStock: p.optimalStock ?? 0,
          fulfillmentType: p.fulfillmentType ?? "stock",
        });
      }
    }
    return rows;
  }
}

export const mallInventoryStorage = new MallInventoryStorage();
