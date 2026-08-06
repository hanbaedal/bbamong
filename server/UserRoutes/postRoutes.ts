import type { Express } from "express";
import { postStorage as storage } from "../UserStorage/postStorage";
import { insertPostSchema, insertCommentSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { memberAuthMiddleware } from "../middleware/memberAuth";
import type { AuthenticatedUserRequest } from "../middleware/userAuth";
import { parseMemberPlatform } from "../utils/memberPlatform";

export async function postRoutes(app: Express): Promise<void> {
  // 게시판 목록 — 빠몽 회원 글 (게스트·회원 읽기)
  app.get("/api/posts", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | undefined;
      const searchType = (req.query.searchType as string) || "title";

      if (searchType && !["all", "author", "title"].includes(searchType)) {
        return res.status(400).json({ error: "잘못된 검색 타입입니다." });
      }

      const result = await storage.getPosts(
        page,
        limit,
        search,
        searchType as "all" | "author" | "title",
        "ppamong",
      );
      return res.json(result);
    } catch (error) {
      console.error("Get posts error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 단일 게시물 조회 (읽기 공개)
  app.get("/api/posts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      if (!(await storage.isPpamongPost(id))) {
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

  // 게시물 생성 (정회원)
  app.post("/api/posts", memberAuthMiddleware, async (req: AuthenticatedUserRequest, res) => {
    try {
      const authorId = req.user!.userId;
      const result = insertPostSchema.safeParse({ ...req.body, authorId });

      if (!result.success) {
        const error = fromZodError(result.error);
        return res.status(400).json({ error: error.message });
      }

      const post = await storage.createPost(result.data);
      return res.status(201).json(post);
    } catch (error) {
      console.error("Create post error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 게시물 수정 (작성자·정회원)
  app.patch("/api/posts/:id", memberAuthMiddleware, async (req: AuthenticatedUserRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      const { title, content } = req.body;
      const updateData: Partial<{ title: string; content: string }> = {};
      if (typeof title === "string") updateData.title = title;
      if (typeof content === "string") updateData.content = content;
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "수정할 내용이 없습니다." });
      }

      const result = await storage.updatePost(id, updateData, req.user!.userId);

      if (!result.success) {
        return res.status(403).json({ error: result.message });
      }

      return res.json(result.post);
    } catch (error) {
      console.error("Update post error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 게시물 삭제 (작성자·정회원)
  app.delete("/api/posts/:id", memberAuthMiddleware, async (req: AuthenticatedUserRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      const result = await storage.deletePost(id, req.user!.userId);

      if (!result.success) {
        return res.status(403).json({ error: result.message });
      }

      return res.json({ success: true, message: result.message });
    } catch (error) {
      console.error("Delete post error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // === 댓글 API ===

  app.get("/api/posts/:postId/comments", async (req, res) => {
    try {
      const postId = parseInt(req.params.postId);
      if (isNaN(postId)) {
        return res.status(400).json({ error: "잘못된 게시물 ID 형식입니다." });
      }

      if (!(await storage.isPpamongPost(postId))) {
        return res.status(404).json({ error: "게시물을 찾을 수 없습니다." });
      }

      const comments = await storage.getCommentsByPostId(postId);
      return res.json(comments);
    } catch (error) {
      console.error("Get comments error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.post("/api/posts/:postId/comments", memberAuthMiddleware, async (req: AuthenticatedUserRequest, res) => {
    try {
      const postId = parseInt(req.params.postId);
      if (isNaN(postId)) {
        return res.status(400).json({ error: "잘못된 게시물 ID 형식입니다." });
      }

      if (!(await storage.isPpamongPost(postId))) {
        return res.status(404).json({ error: "게시물을 찾을 수 없습니다." });
      }

      const commentData = { ...req.body, postId, authorId: req.user!.userId };
      const result = insertCommentSchema.safeParse(commentData);

      if (!result.success) {
        const error = fromZodError(result.error);
        return res.status(400).json({ error: error.message });
      }

      const comment = await storage.createComment(result.data);
      return res.status(201).json(comment);
    } catch (error) {
      console.error("Create comment error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.patch("/api/comments/:id", memberAuthMiddleware, async (req: AuthenticatedUserRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 댓글 ID 형식입니다." });
      }

      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ error: "댓글 내용이 필요합니다." });
      }

      const result = await storage.updateComment(id, content, req.user!.userId);

      if (!result.success) {
        return res.status(403).json({ error: result.message });
      }

      return res.json(result.comment);
    } catch (error) {
      console.error("Update comment error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.delete("/api/comments/:id", memberAuthMiddleware, async (req: AuthenticatedUserRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 댓글 ID 형식입니다." });
      }

      const result = await storage.deleteComment(id, req.user!.userId);

      if (!result.success) {
        return res.status(403).json({ error: result.message });
      }

      return res.json({ success: true, message: result.message });
    } catch (error) {
      console.error("Delete comment error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/admin/posts", adminAuthMiddleware, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 8;
      const search = (req.query.search as string) || "";
      const platform = parseMemberPlatform(req.query.platform);

      const result = await storage.getAdminPosts(platform, page, limit, search);
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

      const post = await storage.getAdminPostDetail(id);
      if (!post) {
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

      const deleted = await storage.adminDeletePost(id);
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
