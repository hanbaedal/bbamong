import type { Express } from "express";
import { noticeStorage as storage } from "../UserStorage/noticeStorage";
import { insertNoticeSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { z } from "zod";

export async function noticeRoutes(app: Express): Promise<void> {
  // 모든 공지사항 조회
  app.get("/api/notices", async (req, res) => {
    try {
      const notices = await storage.getAllNotices();
      return res.json(notices);
    } catch (error) {
      console.error("Get notices error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 단일 공지사항 조회
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

      return res.json(notice);
    } catch (error) {
      console.error("Get notice error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 공지사항 생성
  app.post("/api/notices", async (req, res) => {
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

  // 공지사항 수정
  app.patch("/api/notices/:id", async (req, res) => {
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

  // 공지사항 삭제
  app.delete("/api/notices/:id", async (req, res) => {
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

  // 공지사항 순서 변경
  app.put("/api/notices/reorder", async (req, res) => {
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
