import type { Express } from "express";
import { z } from "zod";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { userAuthMiddleware } from "../middleware/userAuth";
import { MatchModel, PredictionModel } from "../UserStorage/db";
import { getKstDateString } from "../utils/dateUtils";
import { PREDICTION_ODDS } from "@shared/predictionOdds";
import { LIVE_SCORE_SYNC_INTERVAL_MS } from "./constants";
import { fetchDaumKboGameList } from "../daumLive/daumHermesClient";
import {
  importSeasonMatchesFromApiSports,
  mapTodayGames,
  reconcileStuckPregameSideBetLocks,
  setMatchControlMode,
  syncTodayGamesFromApiSports,
  patchMatchLiveScoreboard,
} from "./syncService";
import { syncOperatorMatchAssignments } from "../managerOperatorService";
import { rescheduleTodayMatchTimers } from "./matchManagementSchedule";
import { buildCurrentBatterPreviewFromMatch } from "./lineupService";
import { parseInningHalf } from "@shared/gamePhaseTypes";
import type {
  CurrentBatterPreview,
  MatchLineupSnapshot,
  MatchPlayerStatsEntry,
  MatchTeamSeasonStats,
  PinchHitterSnapshot,
} from "@shared/apiSportsTypes";

export async function apiSportsRoutes(app: Express): Promise<void> {
  app.get("/api/api-sports/health", async (_req, res) => {
    res.json({
      healthy: true,
      source: "daum",
      lastSuccessAt: new Date().toISOString(),
      lastErrorAt: null,
      lastError: null,
      pollIntervalMs: LIVE_SCORE_SYNC_INTERVAL_MS,
      latencyMs: null,
      apiKeyConfigured: false,
    });
  });

  app.get("/api/api-sports/today-games", adminAuthMiddleware, async (req, res) => {
    try {
      const date = (req.query.date as string) || getKstDateString();
      const games = await fetchDaumKboGameList(date.replace(/-/g, ""));
      res.json({ games: mapTodayGames(games, date), source: "daum" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "다음 스포츠 일정 조회 실패";
      res.status(502).json({ error: message });
    }
  });

  app.post("/api/admin/matches/import-season-schedule", adminAuthMiddleware, async (req, res) => {
    try {
      const body = z
        .object({ season: z.number().int().optional() })
        .parse(req.body ?? {});
      const season = body.season ?? new Date().getFullYear();
      const result = await importSeasonMatchesFromApiSports(season, { forceApi: true });
      await syncOperatorMatchAssignments();
      await rescheduleTodayMatchTimers();
      res.json({
        message: `${season}시즌 다음 스포츠 일정 Match 등록 완료 (경기 있는 날 ${result.daysSynced}일)`,
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "시즌 일정 등록 실패";
      res.status(502).json({ error: message });
    }
  });

  app.post("/api/admin/matches/import-season-matches", adminAuthMiddleware, async (req, res) => {
    try {
      const body = z
        .object({
          season: z.number().int().optional(),
          prefetchScheduleCache: z.boolean().optional(),
          forceApi: z.boolean().optional(),
        })
        .parse(req.body ?? {});
      const season = body.season ?? new Date().getFullYear();
      const result = await importSeasonMatchesFromApiSports(season, {
        forceApi: body.forceApi ?? true,
      });
      await syncOperatorMatchAssignments();
      await rescheduleTodayMatchTimers();
      res.json({
        message: `${season}시즌 경기관리 Match 등록 완료 (경기 있는 날 ${result.daysSynced}일)`,
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "시즌 Match 등록 실패";
      res.status(502).json({ error: message });
    }
  });

  app.post("/api/admin/matches/sync-from-api-sports", adminAuthMiddleware, async (req, res) => {
    try {
      const body = z
        .object({ date: z.string().optional(), forceApi: z.boolean().optional() })
        .parse(req.body ?? {});
      const targetDate = body.date ?? getKstDateString();
      const result = await syncTodayGamesFromApiSports(targetDate, { forceApi: body.forceApi ?? true });
      await reconcileStuckPregameSideBetLocks(targetDate);
      await syncOperatorMatchAssignments();
      if (body.forceApi || targetDate === getKstDateString()) {
        await rescheduleTodayMatchTimers();
      }
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "동기화 실패";
      res.status(502).json({ error: message });
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

  app.patch("/api/admin/matches/:id/scoreboard", adminAuthMiddleware, async (req, res) => {
    try {
      const body = z
        .object({
          homeScore: z.number().int().min(0).max(99).optional(),
          awayScore: z.number().int().min(0).max(99).optional(),
          homeHits: z.number().int().min(0).max(99).optional(),
          awayHits: z.number().int().min(0).max(99).optional(),
          homeErrors: z.number().int().min(0).max(99).optional(),
          awayErrors: z.number().int().min(0).max(99).optional(),
          homeWalks: z.number().int().min(0).max(99).optional(),
          awayWalks: z.number().int().min(0).max(99).optional(),
          inning: z.number().int().min(1).max(20).nullable().optional(),
          inningHalf: z.enum(["top", "bottom"]).nullable().optional(),
          lockManual: z.boolean().optional(),
          syncOperatorPhase: z.boolean().optional(),
        })
        .parse(req.body ?? {});
      const match = await patchMatchLiveScoreboard(req.params.id, body);
      res.json({ success: true, match, scoreboard: match.liveScoreboard ?? null });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      const message = error instanceof Error ? error.message : "스코어보드 보정 실패";
      res.status(400).json({ error: message });
    }
  });

  app.get("/api/matches/:id/scoreboard", async (req, res) => {
    try {
      const matchId = req.params.id;
      const match = await MatchModel.findOne({ id: matchId })
        .select(
          "id registrationOrder liveScoreboard apiSportsHomeTeam apiSportsAwayTeam apiSportsHomeTeamId apiSportsAwayTeamId controlMode apiSportsGameId daumGameId startTime gameInning inningHalf batterIndexInHalf matchLineup matchPlayerStats pinchHitter matchTeamSeasonStats",
        )
        .lean();
      if (!match) return res.status(404).json({ error: "경기를 찾을 수 없습니다." });

      let teamSeasonStats = (match.matchTeamSeasonStats as MatchTeamSeasonStats | null) ?? null;
      if (!teamSeasonStats?.home && !teamSeasonStats?.away) {
        // 다음 팀/타자 랭킹 동기화는 수 초가 걸릴 수 있어 스코어보드 첫 응답을 막지 않는다.
        void import("../daumLive/daumSeasonStatsService")
          .then(({ refreshMatchSeasonContext }) => refreshMatchSeasonContext(matchId))
          .catch((error) => {
            console.warn(`[Scoreboard] season stats ${matchId}:`, error);
          });
      }

      let currentBatter: CurrentBatterPreview | null = null;
      const scoreboardHalf = match.liveScoreboard?.inningHalf ?? null;
      const inningHalf = parseInningHalf(match.inningHalf ?? scoreboardHalf);
      currentBatter = buildCurrentBatterPreviewFromMatch(
        {
          id: match.id,
          startTime: match.startTime,
          batterIndexInHalf: match.batterIndexInHalf ?? 1,
          inningHalf,
          matchLineup: (match.matchLineup as MatchLineupSnapshot | null) ?? null,
          matchPlayerStats:
            (match.matchPlayerStats as Record<string, MatchPlayerStatsEntry> | null) ?? null,
          pinchHitter: (match.pinchHitter as PinchHitterSnapshot | null) ?? null,
          liveBatterName: match.liveScoreboard?.situation?.batterName ?? null,
        },
        inningHalf,
      );

      if (currentBatter?.playerName) {
        const liveSide = match.liveScoreboard?.situation?.batsSide;
        if (liveSide === "left" || liveSide === "right") {
          currentBatter = { ...currentBatter, batsSide: liveSide };
        } else if (!currentBatter.batsSide) {
          try {
            const { findBatsThrowsByPlayerName } = await import("../kboRoster/kboRosterService");
            const { parseBatterHandSide } = await import("@shared/batterHandedness");
            const batsThrows = await findBatsThrowsByPlayerName(currentBatter.playerName);
            currentBatter = {
              ...currentBatter,
              batsSide: parseBatterHandSide(batsThrows),
            };
          } catch (error) {
            console.warn(`[Scoreboard] batsThrows ${matchId}:`, error);
          }
        }
      }

      res.json({
        matchId: match.id,
        scoreboard: match.liveScoreboard ?? null,
        controlMode: match.controlMode ?? "auto",
        linked: Boolean(match.daumGameId || match.apiSportsGameId),
        currentBatter,
        teamSeasonStats,
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
        matchId: req.params.matchId,
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
