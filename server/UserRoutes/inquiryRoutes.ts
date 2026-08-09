import type { Express } from "express";
import { inquiryStorage as storage } from "../UserStorage/inquiryStorage";
import { insertInquirySchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { parseMemberPlatform } from "../utils/memberPlatform";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { memberAuthMiddleware } from "../middleware/memberAuth";
import type { AuthenticatedUserRequest } from "../middleware/userAuth";

export async function inquiryRoutes(app: Express): Promise<void> {
  // 문의 등록 (정회원)
  app.post("/api/inquiries", memberAuthMiddleware, async (req: AuthenticatedUserRequest, res) => {
    try {
      const userId = req.user!.userId;
      const result = insertInquirySchema.safeParse({ ...req.body, userId });

      if (!result.success) {
        const error = fromZodError(result.error);
        return res.status(400).json({ error: error.message });
      }

      const inquiry = await storage.createInquiry(result.data);
      return res.status(201).json(inquiry);
    } catch (error) {
      console.error("Create inquiry error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 본인 문의 목록 (정회원)
  app.get("/api/inquiries", memberAuthMiddleware, async (req: AuthenticatedUserRequest, res) => {
    try {
      const userId = req.user!.userId;
      const inquiries = await storage.getInquiriesByUser(userId);
      return res.json(inquiries);
    } catch (error) {
      console.error("Get inquiries error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 단일 문의 조회 (본인만)
  app.get("/api/inquiries/:id", memberAuthMiddleware, async (req: AuthenticatedUserRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      const inquiry = await storage.getInquiry(id);
      if (!inquiry) {
        return res.status(404).json({ error: "문의를 찾을 수 없습니다." });
      }
      if ((inquiry as { dataSource?: string }).dataSource !== "ppamong") {
        return res.status(404).json({ error: "문의를 찾을 수 없습니다." });
      }
      if (inquiry.userId !== req.user!.userId) {
        return res.status(403).json({ error: "본인 문의만 조회할 수 있습니다." });
      }

      return res.json(inquiry);
    } catch (error) {
      console.error("Get inquiry error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 문의 수정 (본인·답변 대기 중)
  app.patch("/api/inquiries/:id", memberAuthMiddleware, async (req: AuthenticatedUserRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      const bodySchema = insertInquirySchema
        .pick({ category: true, title: true, content: true })
        .partial();
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        const error = fromZodError(parsed.error);
        return res.status(400).json({ error: error.message });
      }
      if (Object.keys(parsed.data).length === 0) {
        return res.status(400).json({ error: "수정할 내용이 없습니다." });
      }

      const result = await storage.updateInquiryByOwner(id, req.user!.userId, parsed.data);
      if (!result.success) {
        return res.status(result.message.includes("본인") ? 403 : 400).json({ error: result.message });
      }

      return res.json(result.inquiry);
    } catch (error) {
      console.error("Update inquiry error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 문의 삭제 (본인·답변 대기 중)
  app.delete("/api/inquiries/:id", memberAuthMiddleware, async (req: AuthenticatedUserRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      const result = await storage.deleteInquiryByOwner(id, req.user!.userId);
      if (!result.success) {
        return res.status(result.message.includes("본인") ? 403 : 400).json({ error: result.message });
      }

      return res.json({ success: true, message: result.message });
    } catch (error) {
      console.error("Delete inquiry error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 문의 상태·답변 (관리자)
  app.patch("/api/inquiries/:id/status", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      const { status, response } = req.body;
      if (!status) {
        return res.status(400).json({ error: "상태 값이 필요합니다." });
      }

      const inquiry = await storage.updateInquiryStatus(id, status, response);
      if (!inquiry) {
        return res.status(404).json({ error: "문의를 찾을 수 없습니다." });
      }

      return res.json(inquiry);
    } catch (error) {
      console.error("Update inquiry status error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 관리자 — 문의 삭제
  app.delete("/api/admin/inquiries/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      await storage.deleteInquiry(id);
      return res.json({ success: true, message: "문의가 삭제되었습니다." });
    } catch (error) {
      console.error("Admin delete inquiry error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 관리자용 - 전체 문의 목록 조회 (페이지네이션)
  app.get("/api/admin/inquiries", adminAuthMiddleware, async (req, res) => {
    try {
      const status = req.query.status as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 8;
      const platform = parseMemberPlatform(req.query.platform);

      const result = await storage.getAllInquiries(status, page, limit, platform);
      return res.json(result);
    } catch (error) {
      console.error("Get all inquiries error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}
