import type { Express } from "express";
import { AdminDonationStorage } from "../storage/adminDonationStorage";
import { adminAuthMiddleware } from "../middleware/adminAuth";

const adminDonationStorage = new AdminDonationStorage();

export async function adminDonationRoutes(app: Express): Promise<void> {
  
  app.get("/api/admin/donation-rankings", adminAuthMiddleware, async (req, res) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 8;

      const { data: topDonors, total } = await adminDonationStorage.getTopDonors(page, limit);

      const donorsWithoutPassword = topDonors.map(({ password, verificationCode, ...user }) => user);

      return res.json({
        total,
        data: donorsWithoutPassword,
      });
    } catch (error) {
      console.error("Get donation rankings error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

}
