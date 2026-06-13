// baMatchRoutes.ts
import type { Express } from "express";
import { matchStorage as storage } from "../UserStorage/matchStorage";
import { insertMatchSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export async function baMatchRoutes(app: Express): Promise<void> {
  // 전체 경기 조회 (오늘 날짜의 종료되지 않은 경기만)
  app.get("/api/matches", async (req, res) => {
    try {
      const matches = await storage.getTodayActiveMatches();
      return res.json(matches);
    } catch (error) {
      console.error("Get matches error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 경기 상세 조회
  app.get("/api/matches/:id", async (req, res) => {
    try {
      const id = req.params.id;
      if (!id) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      const match = await storage.getMatchById(id);
      if (!match)
        return res.status(404).json({ error: "경기를 찾을 수 없습니다." });

      return res.json(match);
    } catch (error) {
      console.error("Get match error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 경기 생성
  app.post("/api/matches", async (req, res) => {
    try {
      const result = insertMatchSchema.safeParse(req.body);
      if (!result.success) {
        const error = fromZodError(result.error);
        return res.status(400).json({ error: error.message });
      }

      const stadium = await storage.getStadium(result.data.stadiumId);
      if (!stadium)
        return res.status(400).json({ error: "등록되지 않은 경기장입니다." });

      const match = await storage.createMatch(result.data);
      return res.status(201).json(match);
    } catch (error) {
      console.error("Create match error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 경기 수정
  app.put("/api/matches/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id))
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });

      if (req.body.stadiumId) {
        const stadium = await storage.getStadium(req.body.stadiumId);
        if (!stadium)
          return res.status(400).json({ error: "등록되지 않은 경기장입니다." });
      }

      const match = await storage.updateMatch(id, req.body);
      if (!match)
        return res.status(404).json({ error: "경기를 찾을 수 없습니다." });

      return res.json(match);
    } catch (error) {
      console.error("Update match error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 경기 삭제
  app.delete("/api/matches/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id))
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });

      await storage.deleteMatch(id);
      return res.json({ success: true, message: "경기가 삭제되었습니다." });
    } catch (error) {
      console.error("Delete match error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}
