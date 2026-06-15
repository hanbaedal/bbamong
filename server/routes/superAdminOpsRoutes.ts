import type { Express } from "express";
import { superAdminAuthMiddleware } from "../middleware/adminAuth";
import { superAdminOpsStorage } from "../storage/superAdminOpsStorage";

export async function superAdminOpsRoutes(app: Express): Promise<void> {
  app.get("/api/admin/ops/db-tables", superAdminAuthMiddleware, async (_req, res) => {
    try {
      const tables = await superAdminOpsStorage.listBackupTables();
      res.json({
        tables,
        primarySource: "mongodb",
        postgresConfigured: !!process.env.DATABASE_URL,
      });
    } catch (error) {
      console.error("[Ops] db-tables error:", error);
      res.status(500).json({ error: "테이블 목록 조회에 실패했습니다." });
    }
  });

  app.get("/api/admin/ops/db-backup/:table", superAdminAuthMiddleware, async (req, res) => {
    try {
      const { table } = req.params;
      const source = (req.query.source as string) || "mongodb";

      const payload =
        source === "postgresql"
          ? await superAdminOpsStorage.exportPostgresTable(table)
          : await superAdminOpsStorage.exportMongoTable(table);

      const filename = `${table}_${payload.source}_${new Date().toISOString().slice(0, 10)}.json`;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.json(payload);
    } catch (error: any) {
      console.error("[Ops] db-backup error:", error);
      res.status(400).json({ error: error?.message || "백업에 실패했습니다." });
    }
  });

  app.get("/api/admin/ops/admin-login-status", superAdminAuthMiddleware, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 8;
      const result = await superAdminOpsStorage.getAdminLoginStatus(page, limit);
      res.json(result);
    } catch (error) {
      console.error("[Ops] admin-login-status error:", error);
      res.status(500).json({ error: "관리자 로그인 현황 조회에 실패했습니다." });
    }
  });

  app.get("/api/admin/ops/manager-login-status", superAdminAuthMiddleware, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 8;
      const result = await superAdminOpsStorage.getManagerLoginStatus(page, limit);
      res.json(result);
    } catch (error) {
      console.error("[Ops] manager-login-status error:", error);
      res.status(500).json({ error: "운영자 로그인 현황 조회에 실패했습니다." });
    }
  });

  app.post(
    "/api/admin/ops/admin-login-status/:adminId/force-logout",
    superAdminAuthMiddleware,
    async (req, res) => {
      try {
        await superAdminOpsStorage.forceAdminLogout(req.params.adminId);
        res.json({ success: true, message: "관리자 세션이 종료되었습니다." });
      } catch (error) {
        console.error("[Ops] admin force-logout error:", error);
        res.status(500).json({ error: "세션 종료에 실패했습니다." });
      }
    },
  );

  app.post(
    "/api/admin/ops/manager-login-status/:managerId/force-logout",
    superAdminAuthMiddleware,
    async (req, res) => {
      try {
        await superAdminOpsStorage.forceManagerLogout(req.params.managerId);
        res.json({ success: true, message: "운영자 세션이 종료되었습니다." });
      } catch (error) {
        console.error("[Ops] manager force-logout error:", error);
        res.status(500).json({ error: "세션 종료에 실패했습니다." });
      }
    },
  );
}
