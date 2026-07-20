import type { Express } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import type { MallSort } from "@shared/mallConfig";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { userAuthMiddleware, type AuthenticatedUserRequest } from "../middleware/userAuth";
import { userStorage } from "../UserStorage/userStorage";
import { goodsStorage } from "../UserStorage/goodsStorage";
import { mallOrderStorage } from "../UserStorage/mallOrderStorage";
import { mallProductReviewStorage } from "../UserStorage/mallProductReviewStorage";
import { shopInquiryStorage } from "../UserStorage/shopInquiryStorage";

const orderItemSchema = z.object({
  productId: z.number().int(),
  quantity: z.number().int().min(1).max(99),
  color: z.string().max(100).optional().default(""),
  size: z.string().max(100).optional().default(""),
});

const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1).max(50),
  customerName: z.string().min(1).max(50),
  customerPhone: z.string().min(8).max(30),
  shippingAddress: z.string().min(5).max(500),
  memo: z.string().max(500).optional().default(""),
});

const createReviewSchema = z.object({
  authorName: z.string().min(1).max(30),
  rating: z.number().int().min(1).max(5),
  content: z.string().min(1).max(2000),
});

const createMallInquirySchema = z.object({
  productId: z.number().int(),
  customerName: z.string().min(1).max(50),
  phone: z.string().max(30).optional().default(""),
  email: z.string().max(200).default(""),
  message: z.string().min(1).max(2000),
}).superRefine((data, ctx) => {
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    ctx.addIssue({ code: "custom", message: "이메일 형식이 올바르지 않습니다.", path: ["email"] });
  }
  if (!data.phone.trim() && !data.email.trim()) {
    ctx.addIssue({ code: "custom", message: "전화번호 또는 이메일 중 하나는 필요합니다.", path: ["phone"] });
  }
});

function parsePriceAmount(priceLabel: string, priceAmount?: number): number {
  if (priceAmount && priceAmount > 0) return priceAmount;
  const digits = priceLabel.replace(/[^\d]/g, "");
  const parsed = parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortProducts(
  products: Awaited<ReturnType<typeof goodsStorage.listAllProducts>>,
  sort: MallSort,
) {
  const list = [...products];
  switch (sort) {
    case "price_asc":
      return list.sort((a, b) => parsePriceAmount(a.priceLabel, a.priceAmount) - parsePriceAmount(b.priceLabel, b.priceAmount));
    case "price_desc":
      return list.sort((a, b) => parsePriceAmount(b.priceLabel, b.priceAmount) - parsePriceAmount(a.priceLabel, a.priceAmount));
    case "discount":
      return list.sort((a, b) => {
        const da = a.originalPriceAmount && a.priceAmount ? a.originalPriceAmount - a.priceAmount : 0;
        const db = b.originalPriceAmount && b.priceAmount ? b.originalPriceAmount - b.priceAmount : 0;
        return db - da;
      });
    case "newest":
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case "popular":
    default:
      return list.sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);
  }
}

export async function mallRoutes(app: Express): Promise<void> {
  app.get("/api/mall/products", async (req, res) => {
    try {
      const categoryId = req.query.categoryId
        ? parseInt(String(req.query.categoryId), 10)
        : undefined;
      const sort = (String(req.query.sort || "popular") as MallSort) || "popular";
      const minPrice = req.query.minPrice ? parseInt(String(req.query.minPrice), 10) : undefined;
      const maxPrice = req.query.maxPrice ? parseInt(String(req.query.maxPrice), 10) : undefined;
      const q = String(req.query.q || "").trim().toLowerCase();

      let products = categoryId
        ? await goodsStorage.listProductsByCategory(categoryId, true)
        : await goodsStorage.listAllProducts(true);

      if (q) {
        products = products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.summary.toLowerCase().includes(q) ||
            (p.brand || "").toLowerCase().includes(q),
        );
      }

      if (minPrice !== undefined || maxPrice !== undefined) {
        products = products.filter((p) => {
          const price = parsePriceAmount(p.priceLabel, p.priceAmount);
          if (minPrice !== undefined && price < minPrice) return false;
          if (maxPrice !== undefined && price > maxPrice) return false;
          return true;
        });
      }

      products = sortProducts(products, sort);
      res.json({ products });
    } catch (error) {
      console.error("List mall products error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/mall/categories", async (_req, res) => {
    try {
      const categories = await goodsStorage.listCategories(true);
      res.json({ categories });
    } catch (error) {
      console.error("List mall categories error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/mall/products/:productId/related", async (req, res) => {
    try {
      const productId = parseInt(req.params.productId, 10);
      if (isNaN(productId)) {
        return res.status(400).json({ error: "잘못된 상품 ID입니다." });
      }
      const product = await goodsStorage.getProduct(productId, true);
      if (!product) {
        return res.status(404).json({ error: "상품을 찾을 수 없습니다." });
      }
      const limit = Math.min(12, Math.max(1, parseInt(String(req.query.limit || "8"), 10) || 8));
      const products = await goodsStorage.listRelatedProducts(productId, limit);
      res.json({ products });
    } catch (error) {
      console.error("List related products error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/mall/products/:productId/reviews", async (req, res) => {
    try {
      const productId = parseInt(req.params.productId, 10);
      if (isNaN(productId)) {
        return res.status(400).json({ error: "잘못된 상품 ID입니다." });
      }
      const product = await goodsStorage.getProduct(productId, true);
      if (!product) {
        return res.status(404).json({ error: "상품을 찾을 수 없습니다." });
      }
      const summary = await mallProductReviewStorage.getSummary(productId);
      res.json(summary);
    } catch (error) {
      console.error("List product reviews error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.post("/api/mall/products/:productId/reviews", async (req, res) => {
    try {
      const productId = parseInt(req.params.productId, 10);
      if (isNaN(productId)) {
        return res.status(400).json({ error: "잘못된 상품 ID입니다." });
      }
      const product = await goodsStorage.getProduct(productId, true);
      if (!product) {
        return res.status(404).json({ error: "상품을 찾을 수 없습니다." });
      }
      const parsed = createReviewSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }
      const review = await mallProductReviewStorage.create({
        productId,
        ...parsed.data,
      });
      res.status(201).json({ success: true, review });
    } catch (error) {
      console.error("Create product review error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.post("/api/mall/inquiries", async (req, res) => {
    try {
      const parsed = createMallInquirySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }
      const product = await goodsStorage.getProduct(parsed.data.productId, true);
      if (!product) {
        return res.status(404).json({ error: "상품을 찾을 수 없습니다." });
      }
      const inquiry = await shopInquiryStorage.create({
        productId: product.id,
        productName: product.name,
        customerName: parsed.data.customerName,
        phone: parsed.data.phone,
        email: parsed.data.email,
        message: parsed.data.message,
      });
      res.status(201).json({ success: true, inquiry });
    } catch (error) {
      console.error("Create mall inquiry error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.post("/api/mall/orders", userAuthMiddleware, async (req: AuthenticatedUserRequest, res) => {
    try {
      const member = await userStorage.getUserById(req.user!.userId);
      if (!member || member.provider === "guest") {
        return res.status(403).json({
          error: "주문은 정회원만 가능합니다. 사용자 앱에서 회원가입 후 이용해 주세요.",
          code: "GUEST_NOT_ALLOWED",
        });
      }

      const parsed = createOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }

      const orderItems = [];
      let totalAmount = 0;

      for (const item of parsed.data.items) {
        const product = await goodsStorage.getProduct(item.productId, true);
        if (!product) {
          return res.status(404).json({ error: `상품(ID ${item.productId})을 찾을 수 없습니다.` });
        }
        const priceAmount = parsePriceAmount(product.priceLabel, product.priceAmount);
        if (priceAmount <= 0) {
          return res.status(400).json({ error: `"${product.name}"은(는) 주문 가능한 가격이 설정되지 않았습니다.` });
        }
        const stockError = goodsStorage.validateOrderStock(
          product,
          item.quantity,
          item.color,
          item.size,
        );
        if (stockError) {
          return res.status(400).json({ error: stockError });
        }
        const lineTotal = priceAmount * item.quantity;
        totalAmount += lineTotal;
        const optionLabel = [item.color, item.size].filter(Boolean).join(" / ");
        orderItems.push({
          productId: product.id,
          productName: optionLabel ? `${product.name} (${optionLabel})` : product.name,
          priceAmount,
          quantity: item.quantity,
          imageUrl: product.imageUrl || "",
          color: item.color,
          size: item.size,
        });
      }

      const order = await mallOrderStorage.create({
        userId: member.id,
        customerName: parsed.data.customerName,
        customerPhone: parsed.data.customerPhone,
        shippingAddress: parsed.data.shippingAddress,
        memo: parsed.data.memo,
        items: orderItems,
        totalAmount,
        status: "pending",
      });

      for (const item of parsed.data.items) {
        await goodsStorage.decrementStock(item.productId, item.quantity, item.color, item.size);
      }

      res.status(201).json({ success: true, order });
    } catch (error) {
      console.error("Create mall order error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/mall/orders/me", userAuthMiddleware, async (req: AuthenticatedUserRequest, res) => {
    try {
      const member = await userStorage.getUserById(req.user!.userId);
      if (!member || member.provider === "guest") {
        return res.status(403).json({ error: "정회원만 조회할 수 있습니다." });
      }
      const orders = await mallOrderStorage.listForUser(member.id);
      res.json({ orders });
    } catch (error) {
      console.error("List my mall orders error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/admin/mall/orders", adminAuthMiddleware, async (req, res) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const orders = await mallOrderStorage.listForAdmin(status);
      res.json({ orders });
    } catch (error) {
      console.error("Admin list mall orders error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.patch("/api/admin/mall/orders/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID입니다." });
      }
      const status = req.body?.status;
      const allowed = ["pending", "confirmed", "shipped", "cancelled"];
      if (!allowed.includes(status)) {
        return res.status(400).json({ error: "유효하지 않은 상태입니다." });
      }
      const order = await mallOrderStorage.updateStatus(id, status);
      if (!order) {
        return res.status(404).json({ error: "주문을 찾을 수 없습니다." });
      }
      res.json({ order });
    } catch (error) {
      console.error("Admin update mall order error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.delete("/api/admin/mall/reviews/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID입니다." });
      }
      const deleted = await mallProductReviewStorage.delete(id);
      if (!deleted) {
        return res.status(404).json({ error: "리뷰를 찾을 수 없습니다." });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Admin delete mall review error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}
