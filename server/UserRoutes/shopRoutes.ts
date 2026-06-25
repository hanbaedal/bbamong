import type { Express } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { userAuthMiddleware, type AuthenticatedUserRequest } from "../middleware/userAuth";
import { userStorage } from "../UserStorage/userStorage";
import { shopInquiryStorage } from "../UserStorage/shopInquiryStorage";
import { goodsStorage } from "../UserStorage/goodsStorage";

const createInquirySchema = z.object({
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

export async function shopRoutes(app: Express): Promise<void> {
  app.post("/api/shop/inquiries", userAuthMiddleware, async (req: AuthenticatedUserRequest, res) => {
    try {
      const member = await userStorage.getUserById(req.user!.userId);
      if (!member || member.provider === "guest") {
        return res.status(403).json({ error: "회원 로그인이 필요합니다." });
      }

      const parsed = createInquirySchema.safeParse(req.body);
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
      console.error("Create shop inquiry error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/admin/shop/inquiries", adminAuthMiddleware, async (_req, res) => {
    try {
      const inquiries = await shopInquiryStorage.list();
      res.json({ inquiries });
    } catch (error) {
      console.error("List shop inquiries error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.patch("/api/admin/shop/inquiries/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID입니다." });
      }
      const status = req.body?.status;
      if (status !== "pending" && status !== "done") {
        return res.status(400).json({ error: "status는 pending 또는 done 이어야 합니다." });
      }
      const inquiry = await shopInquiryStorage.updateStatus(id, status);
      if (!inquiry) {
        return res.status(404).json({ error: "문의를 찾을 수 없습니다." });
      }
      res.json({ inquiry });
    } catch (error) {
      console.error("Update shop inquiry error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}
