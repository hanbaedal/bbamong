import type { Express } from "express";
import { AdminDonationStorage } from "../storage/adminDonationStorage";
import { AdminUserStorage } from "../storage/adminUserStorage";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { parseMemberPlatform } from "../utils/memberPlatform";

const adminDonationStorage = new AdminDonationStorage();
const adminUserStorage = new AdminUserStorage();

export async function adminDonationRoutes(app: Express): Promise<void> {
  app.get("/api/admin/donation-rankings", adminAuthMiddleware, async (req, res) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 8;
      const platform = parseMemberPlatform(req.query.platform);

      const [{ data: topDonors, total }, counts] = await Promise.all([
        adminDonationStorage.getTopDonors(platform, page, limit),
        adminUserStorage.getMemberPlatformCounts(),
      ]);

      const donorsWithoutPassword = topDonors.map(({ password, verificationCode, ...user }) => user);

      return res.json({
        total,
        data: donorsWithoutPassword,
        platform,
        counts,
      });
    } catch (error) {
      console.error("Get donation rankings error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}
