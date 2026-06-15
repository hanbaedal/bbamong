import type { Express } from "express";
import { z } from "zod";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import {
  listOperatorAccounts,
  rotateAllOperatorPasswordsNow,
  setOperatorStatus,
  syncOperatorMatchAssignments,
} from "../managerOperatorService";

export async function operatorAdminRoutes(app: Express): Promise<void> {
  app.get("/api/admin/operators", adminAuthMiddleware, async (_req, res) => {
    try {
      const operators = await listOperatorAccounts();
      res.json({ operators });
    } catch (error) {
      console.error("운영자 계정 목록 조회 실패:", error);
      res.status(500).json({ message: "운영자 계정 목록 조회에 실패했습니다." });
    }
  });

  app.patch("/api/admin/operators/:id/status", adminAuthMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = z.object({ status: z.enum(["활성화", "비활성화"]) }).parse(req.body);
      await setOperatorStatus(id, status);
      res.json({ message: "운영자 상태가 변경되었습니다." });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "상태 변경에 실패했습니다.";
      console.error("운영자 상태 변경 실패:", error);
      res.status(400).json({ message });
    }
  });

  app.post("/api/admin/operators/sync-matches", adminAuthMiddleware, async (_req, res) => {
    try {
      await syncOperatorMatchAssignments();
      const operators = await listOperatorAccounts();
      res.json({ message: "경기 할당이 동기화되었습니다.", operators });
    } catch (error) {
      console.error("운영자 경기 동기화 실패:", error);
      res.status(500).json({ message: "경기 할당 동기화에 실패했습니다." });
    }
  });

  app.post("/api/admin/operators/rotate-passwords", adminAuthMiddleware, async (_req, res) => {
    try {
      await rotateAllOperatorPasswordsNow();
      const operators = await listOperatorAccounts();
      res.json({ message: "오늘 비밀번호가 재발급되었습니다.", operators });
    } catch (error) {
      console.error("운영자 비밀번호 재발급 실패:", error);
      res.status(500).json({ message: "비밀번호 재발급에 실패했습니다." });
    }
  });
}
