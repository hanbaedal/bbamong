import type { Express } from "express";
import { postStorage as storage } from "../UserStorage/postStorage"
import { insertPostSchema, insertCommentSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export async function postRoutes(app: Express): Promise<void> {
  app.get("/api/posts", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | undefined;
      const searchType = (req.query.searchType as string) || "title";

      if (searchType && !["all", "author", "title"].includes(searchType)) {
        return res.status(400).json({ error: "잘못된 검색 타입입니다." });
      }

      const result = await storage.getPosts(page, limit, search, searchType as "all" | "author" | "title");
      return res.json(result);
    } catch (error) {
      console.error("Get posts error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 단일 게시물 조회
  app.get("/api/posts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      const post = await storage.getPost(id);
      if (!post) {
        return res.status(404).json({ error: "게시물을 찾을 수 없습니다." });
      }

      // 조회수 증가
      await storage.incrementViewCount(id);

      return res.json(post);
    } catch (error) {
      console.error("Get post error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 게시물 생성
  app.post("/api/posts", async (req, res) => {
    try {
      const result = insertPostSchema.safeParse(req.body);

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

  // 게시물 수정 (작성자만 가능)
  app.patch("/api/posts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      const { userId, ...updateData } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "사용자 ID가 필요합니다." });
      }

      const result = await storage.updatePost(id, updateData, userId);

      if (!result.success) {
        return res.status(403).json({ error: result.message });
      }

      return res.json(result.post);
    } catch (error) {
      console.error("Update post error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 게시물 삭제 (작성자만 가능)
  app.delete("/api/posts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "사용자 ID가 필요합니다." });
      }

      const result = await storage.deletePost(id, userId);

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

  // 특정 게시물의 댓글 조회
  app.get("/api/posts/:postId/comments", async (req, res) => {
    try {
      const postId = parseInt(req.params.postId);
      if (isNaN(postId)) {
        return res.status(400).json({ error: "잘못된 게시물 ID 형식입니다." });
      }

      const comments = await storage.getCommentsByPostId(postId);
      return res.json(comments);
    } catch (error) {
      console.error("Get comments error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 댓글 생성
  app.post("/api/posts/:postId/comments", async (req, res) => {
    try {
      const postId = parseInt(req.params.postId);
      if (isNaN(postId)) {
        return res.status(400).json({ error: "잘못된 게시물 ID 형식입니다." });
      }

      const commentData = { ...req.body, postId };
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

  // 댓글 수정 (작성자만 가능)
  app.patch("/api/comments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 댓글 ID 형식입니다." });
      }

      const { userId, content } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "사용자 ID가 필요합니다." });
      }
      if (!content) {
        return res.status(400).json({ error: "댓글 내용이 필요합니다." });
      }

      const result = await storage.updateComment(id, content, userId);

      if (!result.success) {
        return res.status(403).json({ error: result.message });
      }

      return res.json(result.comment);
    } catch (error) {
      console.error("Update comment error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 댓글 삭제 (작성자만 가능)
  app.delete("/api/comments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 댓글 ID 형식입니다." });
      }

      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "사용자 ID가 필요합니다." });
      }

      const result = await storage.deleteComment(id, userId);

      if (!result.success) {
        return res.status(403).json({ error: result.message });
      }

      return res.json({ success: true, message: result.message });
    } catch (error) {
      console.error("Delete comment error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}