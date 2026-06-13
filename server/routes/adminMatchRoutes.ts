import type { Express } from "express";
import { adminMatchStorage } from "../storage/adminMatchStorage";
import { insertMatchSchema } from "@shared/schema";
import { z } from "zod";
import { adminAuthMiddleware } from "../middleware/adminAuth";

const uuidSchema = z.string().uuid();

export function adminMatchRoutes(app: Express) {
  // 모든 경기 조회
  app.get("/api/admin/matches", adminAuthMiddleware, async (req, res) => {
    try {
      const matches = await adminMatchStorage.getAllMatches();
      res.json(matches);
    } catch (error) {
      console.error("경기 목록 조회 실패:", error);
      res.status(500).json({ message: "경기 목록 조회에 실패했습니다." });
    }
  });

  // 경기 생성
  app.post("/api/admin/matches", adminAuthMiddleware, async (req, res) => {
    try {
      const bodySchema = insertMatchSchema;
      const data = bodySchema.parse(req.body);

      const match = await adminMatchStorage.createMatch(data);
      res.json({ message: "경기가 추가되었습니다.", match });
    } catch (error) {
      console.error("경기 생성 실패:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "입력 데이터가 올바르지 않습니다." });
      }
      res.status(500).json({ message: "경기 생성에 실패했습니다." });
    }
  });

  // 여러 경기 일괄 생성
  app.post("/api/admin/matches/batch", adminAuthMiddleware, async (req, res) => {
    try {
      const batchSchema = z.array(
        insertMatchSchema.extend({
          matchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않습니다.")
        })
      );
      const matchesData = batchSchema.parse(req.body);

      if (matchesData.length === 0) {
        return res.status(400).json({ message: "등록할 경기가 없습니다." });
      }

      // 모든 경기가 같은 matchDate를 가지는지 확인
      const matchDates = matchesData.map(m => m.matchDate);
      const uniqueDates = new Set(matchDates);
      if (uniqueDates.size > 1) {
        return res.status(400).json({ message: "한 번에 여러 날짜의 경기를 등록할 수 없습니다." });
      }

      const selectedDate = matchesData[0].matchDate!;

      console.log("[DEBUG] Received matchesData:", JSON.stringify(matchesData, null, 2));

      // 중복 검증은 storage layer의 트랜잭션에서 수행 (UPSERT 로직)
      // matchDate와 함께 storage에 전달
      const createdMatches = await adminMatchStorage.createMatchBatch(matchesData, selectedDate);
      res.json({ message: "경기가 등록되었습니다.", matches: createdMatches });
    } catch (error) {
      console.error("경기 일괄 생성 실패:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "입력 데이터가 올바르지 않습니다.", errors: error.errors });
      }
      // 충돌 에러 (동시성 문제, 중복 등)는 409 응답
      if (error instanceof Error && error.name === 'MatchConflictError') {
        return res.status(409).json({ message: error.message });
      }
      res.status(500).json({ message: "경기 등록에 실패했습니다." });
    }
  });

  // 경기 수정
  app.put("/api/admin/matches/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = uuidSchema.parse(req.params.id);
      const bodySchema = insertMatchSchema;
      const data = bodySchema.parse(req.body);

      const match = await adminMatchStorage.updateMatch(id, data);
      if (!match) {
        return res.status(404).json({ message: "경기를 찾을 수 없습니다." });
      }

      res.json({ message: "경기가 수정되었습니다.", match });
    } catch (error) {
      console.error("경기 수정 실패:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "입력 데이터가 올바르지 않습니다." });
      }
      res.status(500).json({ message: "경기 수정에 실패했습니다." });
    }
  });

  // 경기 삭제
  app.delete("/api/admin/matches/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = uuidSchema.parse(req.params.id);

      await adminMatchStorage.deleteMatch(id);
      res.json({ message: "경기가 삭제되었습니다." });
    } catch (error) {
      console.error("경기 삭제 실패:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "잘못된 ID 형식입니다." });
      }
      res.status(500).json({ message: "경기 삭제에 실패했습니다." });
    }
  });
}
