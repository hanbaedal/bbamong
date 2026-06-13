import type { Express } from "express";
import { getVictoryRankings } from "../liveMatch/predictionStorage";
import { pointStorage } from "../UserStorage/pointStorage";
import { adminAuthMiddleware } from "../middleware/adminAuth";

export async function adminRankingRoutes(app: Express): Promise<void> {
  
  app.get("/api/rankings/victory", adminAuthMiddleware, async (req, res) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 8;

      const rankings = await getVictoryRankings(page, limit);

      return res.json(rankings);
    } catch (error) {
      console.error("Get victory rankings error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/rankings/points", adminAuthMiddleware, async (req, res) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 8;

      const rankings = await pointStorage.getEarnedPointsRankings(page, limit);

      return res.json(rankings);
    } catch (error) {
      console.error("Get earned points rankings error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}
