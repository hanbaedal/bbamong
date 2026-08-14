import type { Express } from "express";
import { z } from "zod";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import {
  applyTodayStartingLineups,
  getTodayStartingLineups,
} from "../kboLineup/todayStartingLineupService";

export function adminTodayLineupRoutes(app: Express) {
  app.get("/api/admin/today-lineups", adminAuthMiddleware, async (req, res) => {
    try {
      const date = typeof req.query.date === "string" ? req.query.date : undefined;
      const payload = await getTodayStartingLineups(date);
      return res.json(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "오늘의 선발명단을 불러오지 못했습니다.";
      return res.status(400).json({ error: message });
    }
  });

  app.post("/api/admin/today-lineups/apply", adminAuthMiddleware, async (req, res) => {
    try {
      const body = z
        .object({
          date: z.string().optional(),
          matchId: z.string().optional(),
          daumGameId: z.number().int().optional(),
        })
        .parse(req.body ?? {});
      const payload = await applyTodayStartingLineups(body);
      const applied = payload.results.filter((row) => row.applied).length;
      const failed = payload.results.filter((row) => !row.applied);
      return res.json({
        message:
          failed.length > 0 && applied === 0
            ? "적용할 타순이 없습니다."
            : `${applied}개 경기에 선발 타순을 적용했습니다.`,
        ...payload,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "입력 값이 올바르지 않습니다." });
      }
      const message = error instanceof Error ? error.message : "선발 타순 적용에 실패했습니다.";
      return res.status(400).json({ error: message });
    }
  });
}
