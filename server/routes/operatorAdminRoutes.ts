import type { Express } from "express";
import { z } from "zod";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { parseMemberPlatform } from "../utils/memberPlatform";
import {
  ensureOperatorsReady,
  listOperatorAccounts,
  rotateOperatorPassword,
  setOperatorApiSyncEnabled,
  setOperatorStatus,
} from "../managerOperatorService";

export async function operatorAdminRoutes(app: Express): Promise<void> {
  app.get("/api/admin/operators", adminAuthMiddleware, async (req, res) => {
    try {
      const platform = parseMemberPlatform(req.query.platform);
      const data = await listOperatorAccounts(platform);
      res.json(data);
    } catch (error) {
      console.error("운영자 계정 목록 조회 실패:", error);
      res.status(500).json({ message: "운영자 계정 목록 조회에 실패했습니다." });
    }
  });

  app.post("/api/admin/operators/ensure", adminAuthMiddleware, async (_req, res) => {
    try {
      await ensureOperatorsReady();
      const data = await listOperatorAccounts();
      res.json({ message: "운영자 5명 계정이 준비되었습니다.", ...data });
    } catch (error) {
      console.error("운영자 계정 생성 실패:", error);
      res.status(500).json({ message: "운영자 계정 생성에 실패했습니다." });
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

  app.patch("/api/admin/operators/:id/api-sync", adminAuthMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
      await setOperatorApiSyncEnabled(id, enabled);
      const data = await listOperatorAccounts();
      res.json({
        message: enabled ? "실황 연동이 켜졌습니다." : "실황 연동이 꺼졌습니다.",
        ...data,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "동기화 설정 변경에 실패했습니다.";
      console.error("운영자 API 동기화 설정 실패:", error);
      res.status(400).json({ message });
    }
  });

  app.post("/api/admin/operators/:id/rotate-password", adminAuthMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { loginLinkToken } = await rotateOperatorPassword(id);
      const data = await listOperatorAccounts();
      res.json({
        message: "비밀번호와 로그인 링크가 생성되었습니다 (담당 경기 종료 전까지 유효).",
        loginLinkToken,
        ...data,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "비밀번호 생성에 실패했습니다.";
      console.error("운영자 비밀번호 생성 실패:", error);
      res.status(400).json({ message });
    }
  });
}
