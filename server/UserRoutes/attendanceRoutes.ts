import type { Express } from "express";
import { attendanceStorage as storage } from "../UserStorage/attendanceStorage"

export async function attendanceRoutes(app: Express): Promise<void> {

  // 출석 상태 조회
  app.get("/api/attendance/status", async (req, res) => {
    try {
      const userId = req.query.userId as string;

      if (!userId) {
        return res.status(400).json({ error: "사용자 ID가 필요합니다." });
      }

      const status = await storage.getTodayAttendanceStatus(userId);
      return res.json(status);
    } catch (error) {
      console.error("Get attendance status error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.post("/api/attendance/check-in", async (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "사용자 ID가 필요합니다." });
      }

      const result = await storage.checkInAttendance(userId);

      if (!result.success) {
        return res.status(400).json({ 
          success: false, 
          message: result.message, 
          points: result.points 
        });
      }

      return res.json({ 
        success: true, 
        message: result.message, 
        points: result.points 
      });
    } catch (error) {
      console.error("Check-in error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}