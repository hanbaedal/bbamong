import type { Express } from "express";
import { z } from "zod";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { KBO_TEAM_SHORT_LIST, isKboTeamShort } from "@shared/kboHomeStadium";
import { KBO_BATTER_POSITIONS, isKboBatterPosition } from "@shared/kboRoster";
import {
  createKboPlayer,
  deleteKboPlayer,
  listKboPlayers,
  updateKboPlayer,
} from "../kboRoster/kboRosterService";
import { importKboRosterFromApiSports } from "../kboRoster/importFromApiSports";

const writeSchema = z.object({
  team: z.string().refine(isKboTeamShort, "KBO 10구단 약칭이 아닙니다."),
  season: z.number().int().min(2000).max(2100),
  name: z.string().trim().min(1).max(40),
  position: z.string().refine(isKboBatterPosition, "올바른 포지션이 아닙니다."),
  battingAverage: z.union([z.string(), z.number()]).nullable().optional(),
  hits: z.number().int().min(0).max(999).nullable().optional(),
  homeRuns: z.number().int().min(0).max(999).nullable().optional(),
  rbi: z.number().int().min(0).max(999).nullable().optional(),
  ops: z.union([z.string(), z.number()]).nullable().optional(),
  note: z.string().trim().max(80).optional(),
  active: z.boolean().optional(),
});

export function adminKboRosterRoutes(app: Express) {
  app.get("/api/admin/kbo-players", adminAuthMiddleware, async (req, res) => {
    try {
      const team = typeof req.query.team === "string" ? req.query.team : "";
      const season = Number.parseInt(String(req.query.season ?? ""), 10);
      const players = await listKboPlayers({
        team,
        season: Number.isFinite(season) ? season : undefined,
      });
      return res.json({ teams: KBO_TEAM_SHORT_LIST, positions: KBO_BATTER_POSITIONS, players });
    } catch (error) {
      const message = error instanceof Error ? error.message : "선수 목록을 불러오지 못했습니다.";
      return res.status(400).json({ error: message });
    }
  });

  app.post("/api/admin/kbo-players", adminAuthMiddleware, async (req, res) => {
    try {
      const body = writeSchema.parse(req.body ?? {});
      const player = await createKboPlayer(body);
      return res.json({ message: "선수를 등록했습니다.", player });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "입력 값이 올바르지 않습니다." });
      }
      const message = error instanceof Error ? error.message : "선수 등록에 실패했습니다.";
      return res.status(400).json({ error: message });
    }
  });

  app.put("/api/admin/kbo-players/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const body = writeSchema.parse(req.body ?? {});
      const player = await updateKboPlayer(req.params.id, body);
      return res.json({ message: "선수 정보를 수정했습니다.", player });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "입력 값이 올바르지 않습니다." });
      }
      const message = error instanceof Error ? error.message : "선수 수정에 실패했습니다.";
      return res.status(400).json({ error: message });
    }
  });

  app.delete("/api/admin/kbo-players/:id", adminAuthMiddleware, async (req, res) => {
    try {
      await deleteKboPlayer(req.params.id);
      return res.json({ message: "선수를 삭제했습니다." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "선수 삭제에 실패했습니다.";
      return res.status(400).json({ error: message });
    }
  });

  app.post("/api/admin/kbo-players/import-api-sports", adminAuthMiddleware, async (req, res) => {
    try {
      const body = z
        .object({
          scope: z.enum(["team", "all"]).default("team"),
          team: z.string().optional(),
          season: z.number().int().min(2000).max(2100).optional(),
        })
        .parse(req.body ?? {});
      const result = await importKboRosterFromApiSports(body);
      return res.json({
        message: "API-SPORTS 선수단을 저장했습니다.",
        ...result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "입력 값이 올바르지 않습니다." });
      }
      const message = error instanceof Error ? error.message : "선수단 가져오기에 실패했습니다.";
      return res.status(400).json({ error: message });
    }
  });
}
