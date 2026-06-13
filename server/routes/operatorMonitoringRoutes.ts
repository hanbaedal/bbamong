import type { Express } from "express";
import { operatorMonitoringStorage } from "../storage/operatorMonitoringStorage";

export async function operatorMonitoringRoutes(app: Express): Promise<void> {
  app.get("/api/admin/operator-monitoring", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 8;

      const result = await operatorMonitoringStorage.getOperators(page, limit);
      res.json(result);
    } catch (error: any) {
      console.error("운영자 목록 조회 실패:", error);
      res.status(500).json({ message: "운영자 목록 조회 실패" });
    }
  });

  app.post("/api/admin/operator-monitoring/:operatorId/force-logout", async (req, res) => {
    try {
      const { operatorId } = req.params;
      await operatorMonitoringStorage.forceLogout(operatorId);
      res.json({ message: "로그아웃 허가 완료" });
    } catch (error: any) {
      console.error("강제 로그아웃 실패:", error);
      res.status(500).json({ message: "강제 로그아웃 실패" });
    }
  });
}
