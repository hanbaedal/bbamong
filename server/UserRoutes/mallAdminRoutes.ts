import type { Express } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import {
  MALL_COURIER_OPTIONS,
  MALL_ORDER_STATUS_OPTIONS,
  normalizeMallOrderStatus,
  type MallOrderStatus,
} from "@shared/mallOps";
import { isProcureFulfillment } from "@shared/mallProduct";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { goodsStorage } from "../UserStorage/goodsStorage";
import { mallInventoryStorage } from "../UserStorage/mallInventoryStorage";
import { mallOrderStorage } from "../UserStorage/mallOrderStorage";
import { grantMallOrderRewardPoints } from "../UserStorage/mallRewardService";
import { mallPurchaseStorage } from "../UserStorage/mallPurchaseStorage";
import { userStorage } from "../UserStorage/userStorage";

const updateOrderSchema = z.object({
  status: z.enum(["pending", "preparing", "shipped", "cancelled"]).optional(),
  courierCompany: z.string().max(50).optional(),
  trackingNumber: z.string().max(100).optional(),
});

const receiveStockSchema = z.object({
  warehouseId: z.number().int(),
  locationId: z.number().int().optional(),
  productId: z.number().int(),
  color: z.string().max(100).optional().default(""),
  size: z.string().max(100).optional().default(""),
  quantity: z.number().int().min(1),
  memo: z.string().max(500).optional().default(""),
});

const adjustStockSchema = z.object({
  warehouseId: z.number().int(),
  locationId: z.number().int().optional(),
  productId: z.number().int(),
  color: z.string().max(100).optional().default(""),
  size: z.string().max(100).optional().default(""),
  quantityDelta: z.number().int().refine((v) => v !== 0, "수량 변경은 0이 될 수 없습니다."),
  memo: z.string().max(500).optional().default(""),
});

const supplierSchema = z.object({
  name: z.string().min(1).max(100),
  contactName: z.string().max(50).optional().default(""),
  phone: z.string().max(30).optional().default(""),
  email: z.string().max(200).optional().default(""),
  memo: z.string().max(500).optional().default(""),
});

const purchaseLineSchema = z.object({
  productId: z.number().int(),
  productName: z.string().min(1).max(200),
  color: z.string().max(100).optional().default(""),
  size: z.string().max(100).optional().default(""),
  quantity: z.number().int().min(1),
  unitCost: z.number().int().min(0).optional().default(0),
});

const createPurchaseSchema = z.object({
  supplierId: z.number().int(),
  lines: z.array(purchaseLineSchema).min(1),
  memo: z.string().max(500).optional().default(""),
  status: z.enum(["draft", "ordered"]).optional().default("draft"),
});

function parsePeriodQuery(query: Record<string, unknown>) {
  const period = String(query.period || "month");
  const now = new Date();
  let from: Date;
  let to: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (query.from && query.to) {
    from = new Date(String(query.from));
    to = new Date(String(query.to));
    to.setHours(23, 59, 59, 999);
  } else if (period === "day") {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { from, to, period };
}

async function restoreOrderStock(orderId: number): Promise<void> {
  const order = await mallOrderStorage.getById(orderId);
  if (!order || order.stockRestored) return;

  for (const item of order.items) {
    const product = await goodsStorage.getProduct(item.productId);
    if (!product || isProcureFulfillment(product.fulfillmentType)) continue;
    await goodsStorage.incrementStock(
      item.productId,
      item.quantity,
      item.color,
      item.size,
    );
    const wh = await mallInventoryStorage.ensureDefaultWarehouse();
    await mallInventoryStorage.recordMovement({
      warehouseId: wh.id,
      productId: item.productId,
      productName: product.name,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      movementType: "cancel_restore",
      referenceId: orderId,
      memo: `주문 #${orderId} 취소 복구`,
    });
  }
  await mallOrderStorage.updateOrder(orderId, { stockRestored: true });
}

export async function mallAdminRoutes(app: Express): Promise<void> {
  app.get("/api/admin/mall/orders", adminAuthMiddleware, async (req, res) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const orders = await mallOrderStorage.listForAdmin(status);
      res.json({ orders, statusOptions: MALL_ORDER_STATUS_OPTIONS, couriers: MALL_COURIER_OPTIONS });
    } catch (error) {
      console.error("Admin list mall orders error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.patch("/api/admin/mall/orders/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "잘못된 ID입니다." });

      const parsed = updateOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }

      const existing = await mallOrderStorage.getById(id);
      if (!existing) return res.status(404).json({ error: "주문을 찾을 수 없습니다." });

      const nextStatus = parsed.data.status
        ? normalizeMallOrderStatus(parsed.data.status)
        : undefined;

      if (nextStatus === "cancelled" && existing.status !== "cancelled") {
        await restoreOrderStock(id);
      }

      const update: Parameters<typeof mallOrderStorage.updateOrder>[1] = {};
      if (nextStatus) update.status = nextStatus;
      if (parsed.data.courierCompany !== undefined) update.courierCompany = parsed.data.courierCompany;
      if (parsed.data.trackingNumber !== undefined) update.trackingNumber = parsed.data.trackingNumber;
      if (nextStatus === "shipped") update.shippedAt = new Date();

      const order = await mallOrderStorage.updateOrder(id, update);
      if (!order) return res.status(404).json({ error: "주문을 찾을 수 없습니다." });

      if (nextStatus === "shipped" && existing.status !== "shipped") {
        try {
          await grantMallOrderRewardPoints(id);
        } catch (rewardError) {
          console.error(`Mall order #${id} reward grant failed:`, rewardError);
        }
      }

      const refreshed = await mallOrderStorage.getById(id);
      res.json({ order: refreshed ?? order });
    } catch (error) {
      console.error("Admin update mall order error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/admin/mall/sales/summary", adminAuthMiddleware, async (req, res) => {
    try {
      const { from, to, period } = parsePeriodQuery(req.query as Record<string, unknown>);
      const orders = await mallOrderStorage.listForSales(from, to);

      const byProduct = new Map<
        string,
        { productId: number; productName: string; quantity: number; amount: number }
      >();
      const byMember = new Map<
        string,
        { userId: string; userName: string; orderCount: number; quantity: number; amount: number }
      >();

      let totalAmount = 0;
      let totalQuantity = 0;
      let orderCount = orders.length;

      for (const order of orders) {
        totalAmount += order.totalAmount;
        let memberEntry = byMember.get(order.userId);
        if (!memberEntry) {
          const user = await userStorage.getUserById(order.userId);
          memberEntry = {
            userId: order.userId,
            userName: user?.name || order.customerName,
            orderCount: 0,
            quantity: 0,
            amount: 0,
          };
          byMember.set(order.userId, memberEntry);
        }
        memberEntry.orderCount += 1;
        memberEntry.amount += order.totalAmount;

        for (const item of order.items) {
          totalQuantity += item.quantity;
          memberEntry.quantity += item.quantity;
          const key = `${item.productId}:${item.productName}`;
          const pe = byProduct.get(key) ?? {
            productId: item.productId,
            productName: item.productName,
            quantity: 0,
            amount: 0,
          };
          pe.quantity += item.quantity;
          pe.amount += item.priceAmount * item.quantity;
          byProduct.set(key, pe);
        }
      }

      res.json({
        period,
        from,
        to,
        summary: { orderCount, totalQuantity, totalAmount },
        byProduct: Array.from(byProduct.values()).sort((a, b) => b.amount - a.amount),
        byMember: Array.from(byMember.values()).sort((a, b) => b.amount - a.amount),
      });
    } catch (error) {
      console.error("Admin sales summary error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/admin/mall/inventory/summary", adminAuthMiddleware, async (_req, res) => {
    try {
      const [warehouses, locations, stock, movements, reorderAlerts] = await Promise.all([
        mallInventoryStorage.listWarehouses(),
        mallInventoryStorage.listLocations(),
        mallInventoryStorage.listStockSummary(),
        mallInventoryStorage.listMovements(50),
        goodsStorage.listReorderAlerts(),
      ]);
      res.json({ warehouses, locations, stock, movements, reorderAlerts });
    } catch (error) {
      console.error("Admin inventory summary error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.post("/api/admin/mall/inventory/locations", adminAuthMiddleware, async (req, res) => {
    try {
      const warehouseId = parseInt(String(req.body?.warehouseId), 10);
      const code = String(req.body?.code || "").trim();
      if (isNaN(warehouseId) || !code) {
        return res.status(400).json({ error: "창고 ID와 로케이션 코드가 필요합니다." });
      }
      const location = await mallInventoryStorage.createLocation({
        warehouseId,
        code,
        description: String(req.body?.description || ""),
      });
      res.status(201).json({ location });
    } catch (error) {
      console.error("Create location error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.post("/api/admin/mall/inventory/receive", adminAuthMiddleware, async (req, res) => {
    try {
      const parsed = receiveStockSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }
      const movement = await mallInventoryStorage.receiveStock(parsed.data);
      res.status(201).json({ movement });
    } catch (error) {
      console.error("Receive stock error:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "입고 실패" });
    }
  });

  app.post("/api/admin/mall/inventory/adjust", adminAuthMiddleware, async (req, res) => {
    try {
      const parsed = adjustStockSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }
      const movement = await mallInventoryStorage.adjustStock(parsed.data);
      res.status(201).json({ movement });
    } catch (error) {
      console.error("Adjust stock error:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "조정 실패" });
    }
  });

  app.get("/api/admin/mall/purchase", adminAuthMiddleware, async (_req, res) => {
    try {
      const [suppliers, orders, reorderAlerts, products] = await Promise.all([
        mallPurchaseStorage.listSuppliers(),
        mallPurchaseStorage.listPurchaseOrders(),
        goodsStorage.listReorderAlerts(),
        goodsStorage.listAllProducts(false),
      ]);
      res.json({ suppliers, orders, reorderAlerts, products });
    } catch (error) {
      console.error("Admin purchase list error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.post("/api/admin/mall/purchase/suppliers", adminAuthMiddleware, async (req, res) => {
    try {
      const parsed = supplierSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }
      const supplier = await mallPurchaseStorage.createSupplier(parsed.data);
      res.status(201).json({ supplier });
    } catch (error) {
      console.error("Create supplier error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.post("/api/admin/mall/purchase/orders", adminAuthMiddleware, async (req, res) => {
    try {
      const parsed = createPurchaseSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }
      const order = await mallPurchaseStorage.createPurchaseOrder({
        ...parsed.data,
        lines: parsed.data.lines.map((l) => ({ ...l, receivedQuantity: 0 })),
      });
      res.status(201).json({ order });
    } catch (error) {
      console.error("Create purchase order error:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "발주 생성 실패" });
    }
  });

  app.patch("/api/admin/mall/purchase/orders/:id/status", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const status = req.body?.status;
      if (isNaN(id) || !["draft", "ordered", "partial", "received", "cancelled"].includes(status)) {
        return res.status(400).json({ error: "유효하지 않은 요청입니다." });
      }
      const order = await mallPurchaseStorage.updatePurchaseOrderStatus(id, status);
      if (!order) return res.status(404).json({ error: "발주를 찾을 수 없습니다." });
      res.json({ order });
    } catch (error) {
      console.error("Update purchase status error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.post("/api/admin/mall/purchase/orders/:id/receive", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const lineIndex = parseInt(String(req.body?.lineIndex), 10);
      const quantity = parseInt(String(req.body?.quantity), 10);
      const warehouseId = parseInt(String(req.body?.warehouseId), 10);
      const locationId = req.body?.locationId ? parseInt(String(req.body.locationId), 10) : undefined;
      if (isNaN(id) || isNaN(lineIndex) || isNaN(quantity) || isNaN(warehouseId)) {
        return res.status(400).json({ error: "잘못된 요청입니다." });
      }
      const order = await mallPurchaseStorage.receivePurchaseLine(
        id,
        lineIndex,
        quantity,
        warehouseId,
        locationId,
      );
      res.json({ order });
    } catch (error) {
      console.error("Receive purchase line error:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "입고 실패" });
    }
  });
}
