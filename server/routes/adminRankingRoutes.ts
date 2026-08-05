import type { Express } from "express";
import { getVictoryRankings } from "../liveMatch/predictionStorage";
import { pointStorage } from "../UserStorage/pointStorage";
import { AdminUserStorage } from "../storage/adminUserStorage";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { parseMemberPlatform } from "../utils/memberPlatform";

const adminUserStorage = new AdminUserStorage();

export async function adminRankingRoutes(app: Express): Promise<void> {
  app.get("/api/rankings/victory", adminAuthMiddleware, async (req, res) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 8;
      const platform = parseMemberPlatform(req.query.platform);

      const [rankings, counts] = await Promise.all([
        getVictoryRankings(page, limit, platform),
        adminUserStorage.getMemberPlatformCounts(),
      ]);

      return res.json({ ...rankings, platform, counts });
    } catch (error) {
      console.error("Get victory rankings error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/rankings/points", adminAuthMiddleware, async (req, res) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 8;
      const platform = parseMemberPlatform(req.query.platform);

      const [rankings, counts] = await Promise.all([
        pointStorage.getEarnedPointsRankings(page, limit, platform),
        adminUserStorage.getMemberPlatformCounts(),
      ]);

      return res.json({ ...rankings, platform, counts });
    } catch (error) {
      console.error("Get earned points rankings error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}
