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
import { listSystemManuals, resolveSystemManualFile } from "../ops/systemManualsService";

export async function superAdminOpsRoutes(app: Express): Promise<void> {
  app.get("/api/admin/ops/db-tables", superAdminAuthMiddleware, async (_req, res) => {
    try {
      const tables = await superAdminOpsStorage.listBackupTables();
      res.json({
        tables,
        primarySource: "mongodb",
        postgresConfigured: isPostgresConfigured(),
        syncMode: getPgMongoSyncMode(),
        syncScheduleKst: null,
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
      const platform =
        (req.query.platform as string) === "badminton9" ? "badminton9" : "ppamong";
      const result = await superAdminOpsStorage.getAdminLoginStatus(page, limit, platform);
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
      const platform =
        (req.query.platform as string) === "badminton9" ? "badminton9" : "ppamong";
      const result = await superAdminOpsStorage.getManagerLoginStatus(page, limit, platform);
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

  /** 시스템 매뉴얼 목록 (docs/ + GitHub 원본 링크) */
  app.get("/api/admin/ops/system-manuals", superAdminAuthMiddleware, async (_req, res) => {
    try {
      const manuals = await listSystemManuals();
      res.json({
        manuals,
        githubRepo: "hanbaedal/bbamong",
        githubBranch: "main",
        docsPath: "docs",
      });
    } catch (error) {
      console.error("[Ops] system-manuals list error:", error);
      res.status(500).json({ error: "매뉴얼 목록 조회에 실패했습니다." });
    }
  });

  /**
   * 매뉴얼 다운로드
   * - 기본: 서버 docs/ (배포본 = GitHub main)
   * - ?source=github : GitHub raw에서 가져와 저장 후 다운로드
   */
  app.get("/api/admin/ops/system-manuals/:id/download", superAdminAuthMiddleware, async (req, res) => {
    try {
      const forceGithub = req.query.source === "github";
      const { entry, buffer, source } = await resolveSystemManualFile(req.params.id, {
        forceGithub,
      });
      const encoded = encodeURIComponent(entry.fileName);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encoded}`,
      );
      res.setHeader("X-Manual-Source", source);
      res.send(buffer);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "다운로드에 실패했습니다.";
      console.error("[Ops] system-manuals download error:", error);
      res.status(400).json({ error: message });
    }
  });
}
