import type { Express } from "express";
import { stadiumStorage as storage } from "../UserStorage/stadiumStorage"
import { insertStadiumSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export async function stadiumRoutes(app: Express): Promise<void> {
  app.get("/api/stadiums", async (req, res) => {
    try {
      const stadiums = await storage.getAllStadiums();
      return res.json(stadiums);
    } catch (error) {
      console.error("Get stadiums error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 경기장 상세 조회
  app.get("/api/stadiums/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      const stadium = await storage.getStadium(id);
      if (!stadium) {
        return res.status(404).json({ error: "경기장을 찾을 수 없습니다." });
      }

      return res.json(stadium);
    } catch (error) {
      console.error("Get stadium error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 경기장 생성
  app.post("/api/stadiums", async (req, res) => {
    try {
      const result = insertStadiumSchema.safeParse(req.body);

      if (!result.success) {
        const error = fromZodError(result.error);
        return res.status(400).json({ error: error.message });
      }

      const stadium = await storage.createStadium(result.data);
      return res.status(201).json(stadium);
    } catch (error) {
      console.error("Create stadium error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 경기장 수정
  app.put("/api/stadiums/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      const result = insertStadiumSchema.safeParse(req.body);

      if (!result.success) {
        const error = fromZodError(result.error);
        return res.status(400).json({ error: error.message });
      }

      const stadium = await storage.updateStadium(id, result.data);
      if (!stadium) {
        return res.status(404).json({ error: "경기장을 찾을 수 없습니다." });
      }

      return res.json(stadium);
    } catch (error) {
      console.error("Update stadium error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 경기장 삭제
  app.delete("/api/stadiums/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      await storage.deleteStadium(id);
      return res.json({ success: true, message: "경기장이 삭제되었습니다." });
    } catch (error) {
      console.error("Delete stadium error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}