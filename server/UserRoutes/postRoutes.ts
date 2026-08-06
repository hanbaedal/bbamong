import type { Express } from "express";
import { postStorage as storage } from "../UserStorage/postStorage";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { parseMemberPlatform } from "../utils/memberPlatform";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

const officialPostBodySchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요."),
  content: z.string().min(1, "내용을 입력해주세요."),
});

export async function postRoutes(app: Express): Promise<void> {
  // 앱 게시판 — 빠몽(ppamong) 공식 글만 (읽기 전용, 공지와 동일)
  app.get("/api/posts", async (req, res) => {
    try {
      const platformParam = req.query.platform as string | undefined;
      if (platformParam === "ppamong" || platformParam === "badminton9") {
        const platform = platformParam === "badminton9" ? "badminton9" : "ppamong";
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 8;
        const search = (req.query.search as string) || "";
        const result = await storage.getAdminOfficialPosts(platform, page, limit, search);
        return res.json(result);
      }

      const posts = await storage.getOfficialPosts();
      return res.json(posts);
    } catch (error) {
      console.error("Get posts error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/posts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      if (!(await storage.isOfficialPpamongPost(id))) {
        return res.status(404).json({ error: "게시물을 찾을 수 없습니다." });
      }

      const post = await storage.getPost(id);
      if (!post) {
        return res.status(404).json({ error: "게시물을 찾을 수 없습니다." });
      }

      await storage.incrementViewCount(id);
      return res.json(post);
    } catch (error) {
      console.error("Get post error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 회원 글쓰기·댓글 — 운영자 관리 게시판으로 전환
  app.post("/api/posts", (_req, res) => {
    return res.status(403).json({ error: "게시판은 운영자가 관리합니다." });
  });

  app.patch("/api/posts/:id", (_req, res) => {
    return res.status(403).json({ error: "게시판은 운영자가 관리합니다." });
  });

  app.delete("/api/posts/:id", (_req, res) => {
    return res.status(403).json({ error: "게시판은 운영자가 관리합니다." });
  });

  app.get("/api/posts/:id/comments", (_req, res) => {
    return res.json([]);
  });

  app.post("/api/posts/:id/comments", (_req, res) => {
    return res.status(403).json({ error: "게시판은 운영자가 관리합니다." });
  });

  app.patch("/api/comments/:id", (_req, res) => {
    return res.status(403).json({ error: "게시판은 운영자가 관리합니다." });
  });

  app.delete("/api/comments/:id", (_req, res) => {
    return res.status(403).json({ error: "게시판은 운영자가 관리합니다." });
  });

  app.post("/api/admin/posts", adminAuthMiddleware, async (req, res) => {
    try {
      const parsed = officialPostBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }
      const post = await storage.createOfficialPost(parsed.data);
      return res.status(201).json(post);
    } catch (error) {
      console.error("Create official post error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.patch("/api/admin/posts/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }
      const parsed = officialPostBodySchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }
      if (Object.keys(parsed.data).length === 0) {
        return res.status(400).json({ error: "수정할 내용이 없습니다." });
      }
      const post = await storage.updateOfficialPost(id, parsed.data);
      if (!post) {
        return res.status(404).json({ error: "게시물을 찾을 수 없습니다." });
      }
      return res.json(post);
    } catch (error) {
      console.error("Update official post error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/admin/posts", adminAuthMiddleware, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 8;
      const search = (req.query.search as string) || "";
      const platform = parseMemberPlatform(req.query.platform);

      const result = await storage.getAdminOfficialPosts(platform, page, limit, search);
      return res.json(result);
    } catch (error) {
      console.error("Get admin posts error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/admin/posts/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      const post = await storage.getPost(id);
      if (!post || !(await storage.isOfficialPpamongPost(id))) {
        return res.status(404).json({ error: "게시물을 찾을 수 없습니다." });
      }

      return res.json(post);
    } catch (error) {
      console.error("Get admin post detail error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.delete("/api/admin/posts/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      const deleted = await storage.adminDeleteOfficialPost(id);
      if (!deleted) {
        return res.status(404).json({ error: "게시물을 찾을 수 없습니다." });
      }

      return res.json({ success: true, message: "게시물이 삭제되었습니다." });
    } catch (error) {
      console.error("Admin delete post error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}
