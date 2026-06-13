import type { Express } from "express";
import { adminManagerStorage } from "../storage/adminManagerStorage";
import { AdminStorage } from "../storage/adminStorage";
const adminStorage = new AdminStorage();
import { z } from "zod";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { deleteSession } from "../sessionManager";

export async function adminManagerRoutes(app: Express): Promise<void> {
  app.get("/api/admin/admin-managers", adminAuthMiddleware, async (req, res) => {
    try {
      const status = req.query.status as "대기중" | "승인" | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const filterType = (req.query.filterType as string) || "name";

      const result = await adminManagerStorage.getManagers(
        status,
        page,
        limit,
        search,
        filterType,
      );

      res.json({
        ...result,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      });
    } catch (error) {
      console.error("매니저 목록 조회 실패:", error);
      res.status(500).json({ message: "매니저 목록 조회에 실패했습니다." });
    }
  });

  app.patch("/api/admin/admin-managers/:id/approve", adminAuthMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const bodySchema = z.object({
        approvalStatus: z.enum(["승인"]),
      });

      const { approvalStatus } = bodySchema.parse(req.body);
      await adminManagerStorage.approveManager(id, approvalStatus);

      res.json({ message: "매니저가 승인되었습니다." });
    } catch (error) {
      console.error("매니저 승인 실패:", error);
      res.status(500).json({ message: "매니저 승인에 실패했습니다." });
    }
  });

  app.delete("/api/admin/admin-managers/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const { id } = req.params;

      const deleted = await adminStorage.deleteAdminUser(id);
      if (!deleted) {
        return res.status(404).json({ message: "매니저를 찾을 수 없습니다." });
      }

      try {
        await deleteSession("manager", id);
      } catch (sessionError) {
        console.error("[AdminManager] Redis 세션 삭제 실패:", sessionError);
      }

      console.log(`[AdminManager] 매니저 삭제 완료: manager:${id} (데이터 및 세션 삭제)`);

      res.json({ message: "매니저가 삭제되었습니다. 해당 계정으로 재가입이 가능합니다." });
    } catch (error) {
      console.error("매니저 삭제 실패:", error);
      res.status(500).json({ message: "매니저 삭제에 실패했습니다." });
    }
  });
}
