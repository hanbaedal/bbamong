import { Router, Response } from "express";
import { z } from "zod";
import { userAuthMiddleware } from "../middleware/userAuth";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import {
  getUserSideBetsForMatch,
  getSideBetSummaryForMatch,
  upsertSideBet,
} from "./sideBetStorage";
import { getMatchInfo } from "./predictionStorage";
import { isValidSideBetAmount, DEFAULT_SIDE_BET_AMOUNT } from "@shared/predictionOdds";
import { MatchModel, MatchSideBetModel } from "../UserStorage/db";
import { matchStorage } from "../UserStorage/matchStorage";

const router = Router();

const sideBetBodySchema = z.discriminatedUnion("type", [
  z.object({
    matchId: z.string().uuid(),
    type: z.literal("winner"),
    amount: z.number().int().positive().optional(),
    winnerPick: z.enum(["home", "away"]),
  }),
  z.object({
    matchId: z.string().uuid(),
    type: z.literal("score"),
    amount: z.number().int().positive().optional(),
    homeScorePick: z.number().int().min(0).max(30),
    awayScorePick: z.number().int().min(0).max(30),
  }),
]);

router.post("/side-bets", userAuthMiddleware, async (req: any, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "인증이 필요합니다." });

    const body = sideBetBodySchema.parse(req.body);
    const amount = body.amount ?? DEFAULT_SIDE_BET_AMOUNT;
    if (!isValidSideBetAmount(amount)) {
      return res.status(400).json({ error: "사이드 배팅은 100·200·500·1000P만 가능합니다." });
    }

    const match = await getMatchInfo(body.matchId);
    if (!match) return res.status(404).json({ error: "경기를 찾을 수 없습니다." });

    const bet = await upsertSideBet({
      userId,
      matchId: body.matchId,
      type: body.type,
      amount,
      winnerPick: body.type === "winner" ? body.winnerPick : undefined,
      homeScorePick: body.type === "score" ? body.homeScorePick : undefined,
      awayScorePick: body.type === "score" ? body.awayScorePick : undefined,
    });

    res.json(bet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    console.error("side-bet create error:", error);
    res.status(500).json({ error: "사이드 배팅 접수에 실패했습니다." });
  }
});

router.get("/side-bets/me/today", userAuthMiddleware, async (req: any, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "인증이 필요합니다." });

    const matches = await matchStorage.getTodayMatchesForClient();
    const matchIds = matches.map((m) => m.id);
    if (matchIds.length === 0) {
      return res.json({ betsByMatch: {} });
    }

    const bets = await MatchSideBetModel.find({ userId, matchId: { $in: matchIds } }).lean();
    const betsByMatch: Record<string, typeof bets> = {};
    for (const bet of bets) {
      const key = bet.matchId;
      if (!betsByMatch[key]) betsByMatch[key] = [];
      betsByMatch[key]!.push(bet);
    }

    res.json({ betsByMatch });
  } catch (error) {
    console.error("side-bet me today error:", error);
    res.status(500).json({ error: "오늘 사이드 배팅 조회에 실패했습니다." });
  }
});

router.get("/matches/:matchId/side-bets/me", userAuthMiddleware, async (req: any, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "인증이 필요합니다." });

    const match = await MatchModel.findOne({ id: req.params.matchId })
      .select("id sideBetsLocked apiSportsHomeTeam apiSportsAwayTeam matchStatus liveScoreboard")
      .lean();
    if (!match) return res.status(404).json({ error: "경기를 찾을 수 없습니다." });

    const bets = await getUserSideBetsForMatch(userId, req.params.matchId);
    res.json({
      sideBetsLocked: Boolean(match.sideBetsLocked),
      homeTeamName: match.apiSportsHomeTeam ?? null,
      awayTeamName: match.apiSportsAwayTeam ?? null,
      matchStatus: match.matchStatus,
      bets,
    });
  } catch (error) {
    console.error("side-bet me error:", error);
    res.status(500).json({ error: "사이드 배팅 조회에 실패했습니다." });
  }
});

router.get(
  "/matches/:matchId/side-bets/summary",
  adminAuthMiddleware,
  async (req: any, res: Response) => {
    try {
      const match = await MatchModel.findOne({ id: req.params.matchId })
        .select("id sideBetsLocked apiSportsHomeTeam apiSportsAwayTeam")
        .lean();
      if (!match) return res.status(404).json({ error: "경기를 찾을 수 없습니다." });

      const summary = await getSideBetSummaryForMatch(req.params.matchId);
      res.json({
        sideBetsLocked: Boolean(match.sideBetsLocked),
        homeTeamName: match.apiSportsHomeTeam ?? null,
        awayTeamName: match.apiSportsAwayTeam ?? null,
        summary,
      });
    } catch (error) {
      console.error("side-bet summary error:", error);
      res.status(500).json({ error: "사이드 배팅 요약 조회에 실패했습니다." });
    }
  },
);

export default router;
