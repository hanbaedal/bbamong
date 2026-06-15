import type { Express } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { homePageStorage } from "../UserStorage/homePageStorage";
import { goodsStorage } from "../UserStorage/goodsStorage";

const updateHomePageSchema = z.object({
  greetingPrefix: z.string().min(1).max(50),
  subGreeting: z.string().max(100).optional().default(""),
  buttonText: z.string().min(1).max(30),
  buttonEnabled: z.boolean(),
  showDate: z.boolean(),
  gameGuideTitle: z.string().min(1).max(100),
  gameGuideSummary: z.string().max(300),
  gameGuideContent: z.string().max(20000),
  gameGuideEnabled: z.boolean(),
  gameGuideImageUrl: z.string().max(2000).optional().default(""),
  goodsSectionTitle: z.string().min(1).max(100),
  goodsSectionEnabled: z.boolean(),
});

const categorySchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(300).optional().default(""),
  imageUrl: z.string().max(2000).optional().default(""),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional().default(true),
});

const productSchema = z.object({
  categoryId: z.number().int(),
  name: z.string().min(1).max(100),
  summary: z.string().max(500).optional().default(""),
  detailContent: z.string().max(20000).optional().default(""),
  imageUrl: z.string().max(2000).optional().default(""),
  priceLabel: z.string().max(50).optional().default(""),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional().default(true),
});

export async function homePageRoutes(app: Express): Promise<void> {
  app.get("/api/homepage-settings", async (_req, res) => {
    try {
      const settings = await homePageStorage.getSettings();
      res.json(settings);
    } catch (error) {
      console.error("Get homepage settings error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/homepage/content", async (_req, res) => {
    try {
      const content = await homePageStorage.getPublicContent();
      res.json(content);
    } catch (error) {
      console.error("Get homepage content error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/homepage/goods/categories", async (_req, res) => {
    try {
      const categories = await goodsStorage.listCategories(true);
      res.json({ categories });
    } catch (error) {
      console.error("Get goods categories error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/homepage/goods/categories/:categoryId/products", async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId, 10);
      if (isNaN(categoryId)) {
        return res.status(400).json({ error: "잘못된 분류 ID입니다." });
      }
      const category = await goodsStorage.getCategory(categoryId, true);
      if (!category) {
        return res.status(404).json({ error: "분류를 찾을 수 없습니다." });
      }
      const products = await goodsStorage.listProductsByCategory(categoryId, true);
      res.json({ category, products });
    } catch (error) {
      console.error("Get category products error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/homepage/goods/products/:productId", async (req, res) => {
    try {
      const productId = parseInt(req.params.productId, 10);
      if (isNaN(productId)) {
        return res.status(400).json({ error: "잘못된 상품 ID입니다." });
      }
      const product = await goodsStorage.getProduct(productId, true);
      if (!product) {
        return res.status(404).json({ error: "상품을 찾을 수 없습니다." });
      }
      res.json({ product });
    } catch (error) {
      console.error("Get product detail error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/admin/homepage-settings", adminAuthMiddleware, async (_req, res) => {
    try {
      const [settings, categories, products] = await Promise.all([
        homePageStorage.getSettings(),
        goodsStorage.listCategories(false),
        goodsStorage.listAllProducts(false),
      ]);
      res.json({ settings, categories, products });
    } catch (error) {
      console.error("Get admin homepage settings error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.put("/api/admin/homepage-settings", adminAuthMiddleware, async (req, res) => {
    try {
      const result = updateHomePageSchema.safeParse(req.body);
      if (!result.success) {
        const error = fromZodError(result.error);
        return res.status(400).json({ error: error.message });
      }
      const settings = await homePageStorage.updateSettings(result.data);
      res.json(settings);
    } catch (error) {
      console.error("Update homepage settings error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.post("/api/admin/homepage/goods/categories", adminAuthMiddleware, async (req, res) => {
    try {
      const result = categorySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const category = await goodsStorage.createCategory(result.data);
      res.status(201).json(category);
    } catch (error) {
      console.error("Create goods category error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.patch("/api/admin/homepage/goods/categories/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "잘못된 ID입니다." });
      const result = categorySchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const category = await goodsStorage.updateCategory(id, result.data);
      if (!category) return res.status(404).json({ error: "분류를 찾을 수 없습니다." });
      res.json(category);
    } catch (error) {
      console.error("Update goods category error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.delete("/api/admin/homepage/goods/categories/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "잘못된 ID입니다." });
      await goodsStorage.deleteCategory(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete goods category error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.post("/api/admin/homepage/goods/products", adminAuthMiddleware, async (req, res) => {
    try {
      const result = productSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const category = await goodsStorage.getCategory(result.data.categoryId);
      if (!category) {
        return res.status(400).json({ error: "존재하지 않는 분류입니다." });
      }
      const product = await goodsStorage.createProduct(result.data);
      res.status(201).json(product);
    } catch (error) {
      console.error("Create goods product error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.patch("/api/admin/homepage/goods/products/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "잘못된 ID입니다." });
      const result = productSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const product = await goodsStorage.updateProduct(id, result.data);
      if (!product) return res.status(404).json({ error: "상품을 찾을 수 없습니다." });
      res.json(product);
    } catch (error) {
      console.error("Update goods product error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.delete("/api/admin/homepage/goods/products/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "잘못된 ID입니다." });
      await goodsStorage.deleteProduct(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete goods product error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}
