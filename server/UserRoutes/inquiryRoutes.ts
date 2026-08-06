import type { Express } from "express";
import { inquiryStorage as storage } from "../UserStorage/inquiryStorage";
import { fromZodError } from "zod-validation-error";
import { parseMemberPlatform } from "../utils/memberPlatform";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { z } from "zod";

const officialInquiryBodySchema = z.object({
  category: z.string().min(1, "카테고리를 입력해주세요."),
  title: z.string().min(1, "제목을 입력해주세요."),
  content: z.string().min(1, "내용을 입력해주세요."),
  response: z.string().min(1, "답변을 입력해주세요."),
});

export async function inquiryRoutes(app: Express): Promise<void> {
  // 앱 문의 FAQ — 빠몽(ppamong) 운영자 게시만 (읽기 전용, 공지와 동일)
  app.get("/api/inquiries", async (req, res) => {
    try {
      const platformParam = req.query.platform as string | undefined;
      if (platformParam === "ppamong" || platformParam === "badminton9") {
        const status = req.query.status as string;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 8;
        const platform = parseMemberPlatform(req.query.platform);
        const result = await storage.getAllInquiries(status, page, limit, platform);
        return res.json(result);
      }

      const inquiries = await storage.getOfficialInquiries();
      return res.json(inquiries);
    } catch (error) {
      console.error("Get inquiries error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/inquiries/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      if (!(await storage.isOfficialPpamongInquiry(id))) {
        return res.status(404).json({ error: "문의를 찾을 수 없습니다." });
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

  app.post("/api/inquiries", (_req, res) => {
    return res.status(403).json({ error: "문의 내용은 운영자가 관리합니다." });
  });

  app.patch("/api/inquiries/:id", (_req, res) => {
    return res.status(403).json({ error: "문의 내용은 운영자가 관리합니다." });
  });

  app.delete("/api/inquiries/:id", (_req, res) => {
    return res.status(403).json({ error: "문의 내용은 운영자가 관리합니다." });
  });

  app.post("/api/admin/inquiries", adminAuthMiddleware, async (req, res) => {
    try {
      const parsed = officialInquiryBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }
      const inquiry = await storage.createOfficialInquiry(parsed.data);
      return res.status(201).json(inquiry);
    } catch (error) {
      console.error("Create official inquiry error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.patch("/api/admin/inquiries/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }
      const parsed = officialInquiryBodySchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }
      if (Object.keys(parsed.data).length === 0) {
        return res.status(400).json({ error: "수정할 내용이 없습니다." });
      }
      const inquiry = await storage.updateOfficialInquiry(id, parsed.data);
      if (!inquiry) {
        return res.status(404).json({ error: "문의를 찾을 수 없습니다." });
      }
      return res.json(inquiry);
    } catch (error) {
      console.error("Update official inquiry error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

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

  app.delete("/api/admin/inquiries/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      const deletedOfficial = await storage.deleteOfficialInquiry(id);
      if (deletedOfficial) {
        return res.json({ success: true, message: "문의가 삭제되었습니다." });
      }

      await storage.deleteInquiry(id);
      return res.json({ success: true, message: "문의가 삭제되었습니다." });
    } catch (error) {
      console.error("Admin delete inquiry error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/admin/inquiries", adminAuthMiddleware, async (req, res) => {
    try {
      const status = req.query.status as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 8;
      const platform = parseMemberPlatform(req.query.platform);
      const officialOnly = req.query.official === "1";

      if (officialOnly && platform === "ppamong") {
        const all = await storage.getOfficialInquiries();
        const offset = (page - 1) * limit;
        const slice = all.slice(offset, offset + limit);
        return res.json({
          data: slice.map((row) => ({
            ...row,
            userName: "빠몽",
            userUsername: "ppamong-official",
            status: "resolved",
          })),
          total: all.length,
          page,
          limit,
          totalPages: Math.ceil(all.length / limit) || 1,
          pendingCount: 0,
          resolvedCount: all.length,
          platform,
          counts: { ppamong: all.length, badminton9: 0 },
        });
      }

      const result = await storage.getAllInquiries(status, page, limit, platform);
      return res.json(result);
    } catch (error) {
      console.error("Get all inquiries error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}
