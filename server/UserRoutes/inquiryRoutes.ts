import type { Express } from "express";
import { inquiryStorage as storage } from "../UserStorage/inquiryStorage";
import { insertInquirySchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export async function inquiryRoutes(app: Express): Promise<void> {
  // 문의 등록
  app.post("/api/inquiries", async (req, res) => {
    try {
      const result = insertInquirySchema.safeParse(req.body);

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

  // 사용자별 문의 목록 조회
  app.get("/api/inquiries", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      console.log("userId:", userId);
      if (!userId) {
        return res.status(400).json({ error: "사용자 ID가 필요합니다." });
      }

      const inquiries = await storage.getInquiriesByUser(userId);
      return res.json(inquiries);
    } catch (error) {
      console.error("Get inquiries error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 단일 문의 조회
  app.get("/api/inquiries/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      const inquiry = await storage.getInquiry(id);
      if (!inquiry) {
        return res.status(404).json({ error: "문의를 찾을 수 없습니다." });
      }

      return res.json(inquiry);
    } catch (error) {
      console.error("Get inquiry error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 문의 상태 업데이트
  app.patch("/api/inquiries/:id/status", async (req, res) => {
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

  // 문의 삭제
  app.delete("/api/inquiries/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      await storage.deleteInquiry(id);
      return res.json({ success: true, message: "문의가 삭제되었습니다." });
    } catch (error) {
      console.error("Delete inquiry error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 관리자용 - 전체 문의 목록 조회 (페이지네이션)
  app.get("/api/admin/inquiries", async (req, res) => {
    try {
      const status = req.query.status as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 8;

      const result = await storage.getAllInquiries(status, page, limit);
      return res.json(result);
    } catch (error) {
      console.error("Get all inquiries error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}
