import type { Express } from "express";
import { termStorage as storage } from "../UserStorage/termStorage";
import { insertTermSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export async function termRoutes(app: Express): Promise<void> {
  // 타입별 약관 조회 (단일)
  app.get("/api/terms/type/:type", async (req, res) => {
    try {
      const type = req.params.type;
      const term = await storage.getTermByType(type);
      
      if (!term) {
        return res.json({ type, title: "", content: "" });
      }
      
      return res.json(term);
    } catch (error) {
      console.error("Get term by type error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 타입별 약관 저장/업데이트
  app.put("/api/terms/type/:type", async (req, res) => {
    try {
      const type = req.params.type;
      const result = insertTermSchema.safeParse({ ...req.body, type });

      if (!result.success) {
        const error = fromZodError(result.error);
        return res.status(400).json({ error: error.message });
      }

      const term = await storage.createOrUpdateTermByType(result.data);
      return res.json(term);
    } catch (error) {
      console.error("Save term by type error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 타입별 약관 조회
  app.get("/api/terms", async (req, res) => {
    try {
      const type = req.query.type as string;
      if (!type) {
        return res.status(400).json({ error: "타입이 필요합니다." });
      }

      const terms = await storage.getTermsByType(type);
      return res.json(terms);
    } catch (error) {
      console.error("Get terms error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 단일 약관 조회
  app.get("/api/terms/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      const term = await storage.getTerm(id);
      if (!term) {
        return res.status(404).json({ error: "약관을 찾을 수 없습니다." });
      }

      return res.json(term);
    } catch (error) {
      console.error("Get term error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 약관 생성
  app.post("/api/terms", async (req, res) => {
    try {
      const result = insertTermSchema.safeParse(req.body);

      if (!result.success) {
        const error = fromZodError(result.error);
        return res.status(400).json({ error: error.message });
      }

      const term = await storage.createTerm(result.data);
      return res.status(201).json(term);
    } catch (error) {
      console.error("Create term error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 약관 수정
  app.patch("/api/terms/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      const result = insertTermSchema.partial().safeParse(req.body);
      if (!result.success) {
        const error = fromZodError(result.error);
        return res.status(400).json({ error: error.message });
      }

      const term = await storage.updateTerm(id, result.data);
      if (!term) {
        return res.status(404).json({ error: "약관을 찾을 수 없습니다." });
      }

      return res.json(term);
    } catch (error) {
      console.error("Update term error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 약관 삭제
  app.delete("/api/terms/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      await storage.deleteTerm(id);
      return res.json({ success: true, message: "약관이 삭제되었습니다." });
    } catch (error) {
      console.error("Delete term error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}
