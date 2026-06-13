import type { Express } from "express";
import { adminStadiumStorage } from "../storage/adminStadiumStorage";
import { insertStadiumSchema } from "@shared/schema";
import { z } from "zod";
import { adminAuthMiddleware, superAdminAuthMiddleware } from "../middleware/adminAuth";

export function adminStadiumRoutes(app: Express) {
  // 모든 구장 조회
  app.get("/api/admin/stadiums", adminAuthMiddleware, async (req, res) => {
    try {
      const stadiums = await adminStadiumStorage.getAllStadiums();
      res.json(stadiums);
    } catch (error) {
      console.error("구장 목록 조회 실패:", error);
      res.status(500).json({ message: "구장 목록 조회에 실패했습니다." });
    }
  });

  // 구장 생성
  app.post("/api/admin/stadiums", adminAuthMiddleware, async (req, res) => {
    try {
      const bodySchema = insertStadiumSchema;
      const data = bodySchema.parse(req.body);

      const stadium = await adminStadiumStorage.createStadium(data);
      res.json({ message: "구장이 추가되었습니다.", stadium });
    } catch (error) {
      console.error("구장 생성 실패:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "입력 데이터가 올바르지 않습니다." });
      }
      res.status(500).json({ message: "구장 생성에 실패했습니다." });
    }
  });

  // 구장 수정
  app.put("/api/admin/stadiums/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "잘못된 ID 형식입니다." });
      }

      const bodySchema = insertStadiumSchema;
      const data = bodySchema.parse(req.body);

      const stadium = await adminStadiumStorage.updateStadium(id, data);
      if (!stadium) {
        return res.status(404).json({ message: "구장을 찾을 수 없습니다." });
      }

      res.json({ message: "구장이 수정되었습니다.", stadium });
    } catch (error) {
      console.error("구장 수정 실패:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "입력 데이터가 올바르지 않습니다." });
      }
      res.status(500).json({ message: "구장 수정에 실패했습니다." });
    }
  });

  // 구장 삭제
  app.delete("/api/admin/stadiums/:id", superAdminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "잘못된 ID 형식입니다." });
      }

      const matchCount = await adminStadiumStorage.getMatchCountByStadium(id);
      const force = req.query.force === "true";

      if (matchCount > 0 && !force) {
        return res.status(409).json({ 
          message: `이 구장에 연결된 경기가 ${matchCount}개 있습니다. 구장을 삭제하면 해당 경기도 함께 삭제됩니다.`,
          matchCount,
          requireConfirm: true
        });
      }

      await adminStadiumStorage.deleteStadium(id);
      res.json({ message: "구장이 삭제되었습니다." });
    } catch (error) {
      console.error("구장 삭제 실패:", error);
      res.status(500).json({ message: "구장 삭제에 실패했습니다." });
    }
  });
}
