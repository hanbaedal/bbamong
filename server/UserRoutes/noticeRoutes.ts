import type { Express } from "express";
import { noticeStorage as storage } from "../UserStorage/noticeStorage";
import { noticeReadStorage } from "../UserStorage/noticeReadStorage";
import { insertNoticeSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { z } from "zod";
import { userAuthMiddleware, type AuthenticatedUserRequest } from "../middleware/userAuth";
import { adminAuthMiddleware } from "../middleware/adminAuth";

export async function noticeRoutes(app: Express): Promise<void> {
  // 게임 배너용 — 미확인 공지 1건
  app.get("/api/users/notices/banner", userAuthMiddleware, async (req: AuthenticatedUserRequest, res) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "인증이 필요합니다." });
      }
      const notice = await noticeReadStorage.getLatestUnreadNotice(userId);
      return res.json({ notice: notice ?? null });
    } catch (error) {
      console.error("Get notice banner error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 공지 배너/모달 닫기 (더 이상 표시 안 함)
  app.post("/api/users/notices/:id/dismiss", userAuthMiddleware, async (req: AuthenticatedUserRequest, res) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "인증이 필요합니다." });
      }
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }
      const notice = await storage.getNotice(id);
      if (!notice) {
        return res.status(404).json({ error: "공지사항을 찾을 수 없습니다." });
      }
      await noticeReadStorage.dismissNotice(userId, id);
      return res.json({ success: true });
    } catch (error) {
      console.error("Dismiss notice error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 앱 홈 — 빠몽(ppamong) 공지만 (읽기 전용)
  app.get("/api/notices", async (req, res) => {
    try {
      const platformParam = req.query.platform as string | undefined;
      if (platformParam === "ppamong" || platformParam === "badminton9") {
        const platform = platformParam === "badminton9" ? "badminton9" : "ppamong";
        const result = await storage.getNoticesForPlatform(platform);
        return res.json(result);
      }
      const result = await storage.getNoticesForPlatform("ppamong");
      return res.json(result.notices);
    } catch (error) {
      console.error("Get notices error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 단일 공지 — 빠몽 공지만
  app.get("/api/notices/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      const notice = await storage.getNotice(id);
      if (!notice) {
        return res.status(404).json({ error: "공지사항을 찾을 수 없습니다." });
      }

      if ((notice as { dataSource?: string }).dataSource !== "ppamong") {
        return res.status(404).json({ error: "공지사항을 찾을 수 없습니다." });
      }

      return res.json(notice);
    } catch (error) {
      console.error("Get notice error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 공지사항 생성 (관리자)
  app.post("/api/notices", adminAuthMiddleware, async (req, res) => {
    try {
      const result = insertNoticeSchema.safeParse(req.body);

      if (!result.success) {
        const error = fromZodError(result.error);
        return res.status(400).json({ error: error.message });
      }

      const notice = await storage.createNotice(result.data);
      return res.status(201).json(notice);
    } catch (error) {
      console.error("Create notice error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 공지사항 수정 (관리자)
  app.patch("/api/notices/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      const result = insertNoticeSchema.partial().safeParse(req.body);
      if (!result.success) {
        const error = fromZodError(result.error);
        return res.status(400).json({ error: error.message });
      }

      const notice = await storage.updateNotice(id, result.data);
      if (!notice) {
        return res.status(404).json({ error: "공지사항을 찾을 수 없습니다." });
      }

      return res.json(notice);
    } catch (error) {
      console.error("Update notice error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 공지사항 삭제 (관리자)
  app.delete("/api/notices/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      await storage.deleteNotice(id);
      return res.json({ success: true, message: "공지사항이 삭제되었습니다." });
    } catch (error) {
      console.error("Delete notice error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 공지사항 순서 변경 (관리자)
  app.put("/api/notices/reorder", adminAuthMiddleware, async (req, res) => {
    try {
      const schema = z.object({
        updates: z.array(
          z.object({
            id: z.number(),
            displayOrder: z.number(),
          })
        ),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        const error = fromZodError(result.error);
        return res.status(400).json({ error: error.message });
      }

      await storage.updateNoticeOrders(result.data.updates);
      return res.json({ success: true, message: "공지사항 순서가 변경되었습니다." });
    } catch (error) {
      console.error("Reorder notices error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}
