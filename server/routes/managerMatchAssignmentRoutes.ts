import type { Express } from "express";
import { managerMatchAssignmentStorage } from "../storage/managerMatchAssignmentStorage";
import { deleteSession } from "../sessionManager";
import { z } from "zod";

export async function managerMatchAssignmentRoutes(app: Express): Promise<void> {
  app.get("/api/admin/manager-match-assignments", async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 8;
      
      const result = await managerMatchAssignmentStorage.getManagers(search, page, limit);
      res.json(result);
    } catch (error) {
      console.error("매니저 목록 조회 실패:", error);
      res.status(500).json({ message: "매니저 목록 조회에 실패했습니다." });
    }
  });

  app.get("/api/admin/manager-match-assignments/matches", async (req, res) => {
    try {
      const matches = await managerMatchAssignmentStorage.getAllMatches();
      res.json(matches);
    } catch (error) {
      console.error("경기 목록 조회 실패:", error);
      res.status(500).json({ message: "경기 목록 조회에 실패했습니다." });
    }
  });

  app.post("/api/admin/manager-match-assignments/assign", async (req, res) => {
    try {
      const bodySchema = z.object({
        managerId: z.string(),
        matchNumber: z.enum(["1경기", "2경기", "3경기", "4경기", "5경기"]),
      });

      const { managerId, matchNumber } = bodySchema.parse(req.body);

      await managerMatchAssignmentStorage.assignMatch(managerId, matchNumber);

      res.json({ message: "경기 번호가 할당되었습니다." });
    } catch (error: any) {
      console.error("경기 할당 실패:", error);
      if (error.message.includes("이미 할당된")) {
        return res.status(409).json({ message: error.message });
      }
      res.status(500).json({ message: "경기 할당에 실패했습니다." });
    }
  });

  app.get("/api/admin/manager-match-assignments/available-numbers", async (req, res) => {
    try {
      const availableNumbers = await managerMatchAssignmentStorage.getAvailableMatchNumbers();
      res.json(availableNumbers);
    } catch (error) {
      console.error("사용 가능한 경기 번호 조회 실패:", error);
      res.status(500).json({ message: "사용 가능한 경기 번호 조회에 실패했습니다." });
    }
  });

  app.post("/api/admin/manager-match-assignments/unassign", async (req, res) => {
    try {
      const bodySchema = z.object({
        managerId: z.string(),
      });

      const { managerId } = bodySchema.parse(req.body);

      await managerMatchAssignmentStorage.unassignMatch(managerId);

      res.json({ message: "경기 할당이 해제되었습니다." });
    } catch (error) {
      console.error("경기 할당 해제 실패:", error);
      res.status(500).json({ message: "경기 할당 해제에 실패했습니다." });
    }
  });

  app.patch("/api/admin/manager-match-assignments/:managerId/status", async (req, res) => {
    try {
      const managerId = req.params.managerId;
      const bodySchema = z.object({
        status: z.enum(["활성화", "비활성화"]),
      });

      const { status } = bodySchema.parse(req.body);

      await managerMatchAssignmentStorage.updateManagerStatus(managerId, status);

      if (status === "비활성화") {
        await managerMatchAssignmentStorage.unassignMatch(managerId);
        await deleteSession("manager", managerId);
        const { wsManager } = await import("../liveMatch/wsManager");
        wsManager.forceDisconnectBySubjectId("manager", managerId);
        console.log(`[ManagerStatus] 매니저 비활성화 → 경기 할당 해제, 세션 삭제, WebSocket 강제 종료: ${managerId}`);
      }

      console.log(`[ManagerStatus] 매니저 상태 변경: ${managerId} → ${status}`);

      res.json({ message: "매니저 상태가 업데이트되었습니다." });
    } catch (error) {
      console.error("매니저 상태 업데이트 실패:", error);
      res.status(500).json({ message: "매니저 상태 업데이트에 실패했습니다." });
    }
  });
}
