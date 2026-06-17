import type { Express } from "express";
import { superAdminAuthMiddleware } from "../middleware/adminAuth";
import { superAdminOpsStorage } from "../storage/superAdminOpsStorage";
import {
  getLastPostgresMongoSyncResult,
  getPgMongoSyncMode,
  getSyncablePgTables,
  isPostgresMongoSyncRunning,
  syncPostgresTableToMongo,
  syncPostgresTablesToMongo,
  syncPostgresToMongo,
} from "../storage/postgresToMongoSync";
import { isPostgresConfigured } from "../storage/postgresClient";

export async function superAdminOpsRoutes(app: Express): Promise<void> {
  app.get("/api/admin/ops/db-tables", superAdminAuthMiddleware, async (_req, res) => {
    try {
      const tables = await superAdminOpsStorage.listBackupTables();
      res.json({
        tables,
        primarySource: "mongodb",
        postgresConfigured: isPostgresConfigured(),
        syncMode: getPgMongoSyncMode(),
        syncScheduleKst:
          isPostgresConfigured() && process.env.PG_MONGO_SYNC_ENABLED === "true"
            ? `${String(parseInt(process.env.PG_MONGO_SYNC_HOUR_KST || "1", 10) || 1).padStart(2, "0")}:${String(parseInt(process.env.PG_MONGO_SYNC_MINUTE_KST || "0", 10) || 0).padStart(2, "0")}`
            : null,
        syncIntervalMinutes: null,
        lastSync: getLastPostgresMongoSyncResult(),
        syncRunning: isPostgresMongoSyncRunning(),
        syncableTables: getSyncablePgTables(),
      });
    } catch (error) {
      console.error("[Ops] db-tables error:", error);
      res.status(500).json({ error: "테이블 목록 조회에 실패했습니다." });
    }
  });

  app.post("/api/admin/ops/sync-postgres-to-mongo", superAdminAuthMiddleware, async (req, res) => {
    try {
      const tables = Array.isArray(req.body?.tables) ? (req.body.tables as string[]) : undefined;
      const result = tables?.length
        ? await syncPostgresTablesToMongo(tables)
        : await syncPostgresToMongo();
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "동기화에 실패했습니다.";
      console.error("[Ops] sync-postgres-to-mongo error:", error);
      res.status(400).json({ error: message });
    }
  });

  app.post(
    "/api/admin/ops/sync-postgres-to-mongo/:table",
    superAdminAuthMiddleware,
    async (req, res) => {
      try {
        const result = await syncPostgresTableToMongo(req.params.table);
        res.json(result);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "저장에 실패했습니다.";
        console.error("[Ops] sync-postgres-to-mongo table error:", error);
        res.status(400).json({ error: message });
      }
    },
  );

  app.get("/api/admin/ops/sync-postgres-to-mongo/status", superAdminAuthMiddleware, async (_req, res) => {
    res.json({
      postgresConfigured: isPostgresConfigured(),
      syncRunning: isPostgresMongoSyncRunning(),
      lastSync: getLastPostgresMongoSyncResult(),
    });
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
