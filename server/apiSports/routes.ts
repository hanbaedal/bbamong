import type { Express } from "express";
import { z } from "zod";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { userAuthMiddleware } from "../middleware/userAuth";
import { MatchModel, PredictionModel } from "../UserStorage/db";
import { getKstDateString } from "../utils/dateUtils";
import { PREDICTION_ODDS } from "@shared/predictionOdds";
import { getApiSportsHealth } from "./healthState";
import { getScheduleGamesForDate, importSeasonScheduleToCache } from "./scheduleCache";
import {
  linkMatchToApiSports,
  mapTodayGames,
  setMatchControlMode,
  syncTodayGamesFromApiSports,
} from "./syncService";
import { syncOperatorMatchAssignments } from "../managerOperatorService";

export async function apiSportsRoutes(app: Express): Promise<void> {
  app.get("/api/api-sports/health", async (_req, res) => {
    res.json(getApiSportsHealth());
  });

  app.get("/api/api-sports/today-games", adminAuthMiddleware, async (req, res) => {
    try {
      const date = (req.query.date as string) || getKstDateString();
      const { games, source } = await getScheduleGamesForDate(date);
      res.json({ games: mapTodayGames(games), source });
    } catch (error) {
      const message = error instanceof Error ? error.message : "API-SPORTS 조회 실패";
      res.status(502).json({ error: message, health: getApiSportsHealth() });
    }
  });

  app.post("/api/admin/matches/import-season-schedule", adminAuthMiddleware, async (req, res) => {
    try {
      const body = z
        .object({ season: z.number().int().optional() })
        .parse(req.body ?? {});
      const season = body.season ?? new Date().getFullYear();
      const result = await importSeasonScheduleToCache(season);
      res.json({
        message: `${season}시즌 일정 적재 완료 (API 호출 ${result.daysFetchedFromApi}일)`,
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "시즌 일정 적재 실패";
      res.status(502).json({ error: message });
    }
  });

  app.post("/api/admin/matches/sync-from-api-sports", adminAuthMiddleware, async (req, res) => {
    try {
      const body = z.object({ date: z.string().optional() }).parse(req.body ?? {});
      const result = await syncTodayGamesFromApiSports(body.date);
      await syncOperatorMatchAssignments();
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "동기화 실패";
      res.status(502).json({ error: message });
    }
  });

  app.post("/api/admin/matches/:id/link-api-sports", adminAuthMiddleware, async (req, res) => {
    try {
      const { apiSportsGameId } = z.object({ apiSportsGameId: z.number().int().positive() }).parse(req.body);
      const match = await linkMatchToApiSports(req.params.id, apiSportsGameId);
      res.json({ success: true, match });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      const message = error instanceof Error ? error.message : "연결 실패";
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/admin/matches/:id/control-mode", adminAuthMiddleware, async (req, res) => {
    try {
      const { mode } = z.object({ mode: z.enum(["auto", "manual"]) }).parse(req.body);
      const match = await setMatchControlMode(req.params.id, mode);
      res.json({ success: true, match });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      const message = error instanceof Error ? error.message : "모드 변경 실패";
      res.status(400).json({ error: message });
    }
  });

  app.get("/api/matches/:id/scoreboard", async (req, res) => {
    try {
      const match = await MatchModel.findOne({ id: req.params.id })
        .select("id liveScoreboard apiSportsHomeTeam apiSportsAwayTeam controlMode apiSportsGameId")
        .lean();
      if (!match) return res.status(404).json({ error: "경기를 찾을 수 없습니다." });
      res.json({
        matchId: match.id,
        scoreboard: match.liveScoreboard ?? null,
        controlMode: match.controlMode ?? "auto",
        linked: Boolean(match.apiSportsGameId),
      });
    } catch (error) {
      console.error("scoreboard error:", error);
      res.status(500).json({ error: "스코어보드 조회 실패" });
    }
  });

  app.get("/api/live-match/matches/:matchId/betting-distribution", async (req, res) => {
    try {
      const match = await MatchModel.findOne({ id: req.params.matchId }).lean();
      if (!match) return res.status(404).json({ error: "경기를 찾을 수 없습니다." });

      const predictions = await PredictionModel.find({
        matchId: req.params.matchId,
        roundNumber: match.currentRound,
        status: "pending",
      }).lean();

      const buckets = Object.keys(PREDICTION_ODDS).map((prediction) => {
        const rows = predictions.filter((p) => p.prediction === prediction);
        return {
          prediction,
          count: rows.length,
          totalPoints: rows.reduce((sum, p) => sum + (p.amount ?? 100), 0),
          odds: PREDICTION_ODDS[prediction as keyof typeof PREDICTION_ODDS],
        };
      });

      res.json({
        matchId: match.id,
        currentRound: match.currentRound,
        predictionEnabled: match.predictionEnabled,
        distribution: buckets,
        totalParticipants: predictions.length,
        totalPoints: predictions.reduce((sum, p) => sum + (p.amount ?? 100), 0),
      });
    } catch (error) {
      console.error("betting distribution error:", error);
      res.status(500).json({ error: "배팅 현황 조회 실패" });
    }
  });

  app.post("/api/live-match/ad-reward", userAuthMiddleware, async (req: any, res) => {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: "인증이 필요합니다." });

      const { matchId, rewardKey } = z
        .object({
          matchId: z.string(),
          rewardKey: z.string().min(1),
        })
        .parse(req.body);

      const { grantAdRewardPoints } = await import("../liveMatch/adRewardService");
      const result = await grantAdRewardPoints(userId, matchId, rewardKey);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      const message = error instanceof Error ? error.message : "보상 지급 실패";
      res.status(400).json({ error: message });
    }
  });
}
