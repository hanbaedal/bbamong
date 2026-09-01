/**
 * 딜레이 전용 HTTP API.
 * /api/live-match · PredictionModel 쓰기 · Match 쓰기를 하지 않는다.
 * 실시간 참여 여부는 PredictionModel 읽기만으로 검사한다.
 */
import { Router, type Response } from "express";
import {
  DELAY_LIVE_BLOCK_MESSAGE,
  delayUiStage,
  isDelayMatchOngoing,
  isDelaySuggestedResult,
} from "@shared/delayGame";
import { isValidBetAmount, DEFAULT_BET_AMOUNT } from "@shared/predictionOdds";
import { resolveMatchTeamNames } from "@shared/matchTeamDisplay";
import { userAuthMiddleware, type AuthenticatedUserRequest } from "../middleware/userAuth";
import {
  mongoose,
  MatchModel,
  StadiumModel,
  UserModel,
  PointTransactionModel,
  PredictionModel,
  getNextSequence,
} from "../UserStorage/db";
import { DelayGameStateModel, DelayPredictionModel } from "./models";
import { todayDelayMatchFilter } from "./engine";
import { grantDelayAdRewardPoints } from "./adReward";
import { buildDelayCurrentBatter } from "./batterPreview";
import type {
  LiveScoreboard,
  MatchLineupSnapshot,
  MatchPlayerStatsEntry,
  PinchHitterSnapshot,
} from "@shared/apiSportsTypes";

const router = Router();

function extractMatchNumber(name: string): number {
  const match = String(name).match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

async function hasLivePrediction(userId: string, matchId: string): Promise<boolean> {
  const found = await PredictionModel.findOne({ userId, matchId }).select("id").lean();
  return Boolean(found);
}

async function liveParticipatedMatchIds(userId: string): Promise<Set<string>> {
  const ids = await PredictionModel.distinct("matchId", { userId });
  return new Set(ids.map((id) => String(id)));
}

function serializeDelayState(doc: Record<string, unknown> | null) {
  if (!doc) return null;
  const phase = typeof doc.phase === "string" ? doc.phase : "idle";
  return {
    phase,
    uiStage: delayUiStage(phase as "idle" | "open" | "closed" | "ad" | "ended"),
    roundNumber: typeof doc.roundNumber === "number" ? doc.roundNumber : 0,
    batterName: (doc.batterName as string | null) ?? null,
    settledResult: isDelaySuggestedResult(doc.settledResult) ? doc.settledResult : null,
    pendingResult: isDelaySuggestedResult(doc.pendingResult) ? doc.pendingResult : null,
    openAtMs: typeof doc.openAtMs === "number" ? doc.openAtMs : null,
    adUntilMs: typeof doc.adUntilMs === "number" ? doc.adUntilMs : null,
    adReason: doc.adReason === "switch_half" || doc.adReason === "pitcher_change" ? doc.adReason : null,
    adRewardKey: typeof doc.adRewardKey === "string" ? doc.adRewardKey : null,
    lastInning: typeof doc.lastInning === "number" ? doc.lastInning : null,
    lastHalf: typeof doc.lastHalf === "string" ? doc.lastHalf : null,
  };
}

function serializePrediction(doc: Record<string, unknown> | null) {
  if (!doc) return null;
  return {
    id: doc.id,
    roundNumber: doc.roundNumber,
    prediction: doc.prediction,
    amount: doc.amount,
    status: doc.status,
    result: doc.result ?? null,
    wonAmount: doc.wonAmount ?? 0,
  };
}

router.get("/matches", userAuthMiddleware, async (req: AuthenticatedUserRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "인증이 필요합니다." });
    }

    const docs = await MatchModel.find(todayDelayMatchFilter())
      .select(
        "id name stadiumId startTime matchStatus registrationOrder apiSportsHomeTeam apiSportsAwayTeam liveScoreboard matchHeadToHead matchLineup",
      )
      .lean();

    const stadiumIds = [...new Set(docs.map((d) => d.stadiumId).filter((id) => typeof id === "number"))];
    const stadiums = await StadiumModel.find({ id: { $in: stadiumIds } })
      .select("id name")
      .lean();
    const stadiumNameById = new Map(stadiums.map((s) => [s.id, s.name]));

    const delayStates = await DelayGameStateModel.find({
      sourceMatchId: { $in: docs.map((d) => String(d.id)) },
    })
      .select("sourceMatchId phase roundNumber")
      .lean();
    const delayByMatch = new Map(delayStates.map((d) => [String(d.sourceMatchId), d]));

    const blocked = await liveParticipatedMatchIds(userId);

    const matches = docs
      .map((doc) => {
        const liveScoreboard = (doc as { liveScoreboard?: Record<string, unknown> | null }).liveScoreboard ?? null;
        const { awayTeamName, homeTeamName } = resolveMatchTeamNames({
          apiSportsAwayTeam: doc.apiSportsAwayTeam as string | null,
          apiSportsHomeTeam: doc.apiSportsHomeTeam as string | null,
          liveScoreboard: liveScoreboard as never,
        });
        const headToHead = (doc as { matchHeadToHead?: { awayWins?: number; homeWins?: number; season?: number } | null })
          .matchHeadToHead;
        const delay = delayByMatch.get(String(doc.id));
        const order =
          typeof doc.registrationOrder === "number" && doc.registrationOrder >= 1
            ? doc.registrationOrder
            : extractMatchNumber(String(doc.name || ""));
        return {
          id: String(doc.id),
          name: doc.name,
          stadiumId: doc.stadiumId,
          stadiumName: stadiumNameById.get(doc.stadiumId) || "",
          startTime: doc.startTime,
          matchStatus: doc.matchStatus,
          registrationOrder: order,
          awayTeamName,
          homeTeamName,
          headToHead: headToHead
            ? {
                awayWins: headToHead.awayWins ?? 0,
                homeWins: headToHead.homeWins ?? 0,
                season: headToHead.season,
              }
            : null,
          liveScoreboard,
          liveParticipated: blocked.has(String(doc.id)),
          delayPhase: delay?.phase ?? null,
          delayRoundNumber: delay?.roundNumber ?? 0,
        };
      })
      .sort((a, b) => {
        if (a.registrationOrder !== b.registrationOrder) return a.registrationOrder - b.registrationOrder;
        return extractMatchNumber(String(a.name)) - extractMatchNumber(String(b.name));
      });

    res.json(matches);
  } catch (error) {
    console.error("[DelayGame] list matches failed:", error);
    res.status(500).json({ error: "딜레이 경기 목록을 불러오지 못했습니다." });
  }
});

router.get("/:matchId/state", userAuthMiddleware, async (req: AuthenticatedUserRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const matchId = String(req.params.matchId || "");
    if (!userId) {
      return res.status(401).json({ error: "인증이 필요합니다." });
    }
    if (!matchId) {
      return res.status(400).json({ error: "경기 ID가 필요합니다." });
    }

    const match = await MatchModel.findOne({ id: matchId })
      .select(
        "id name stadiumId startTime matchStatus registrationOrder apiSportsHomeTeam apiSportsAwayTeam liveScoreboard matchHeadToHead matchLineup matchPlayerStats pinchHitter gameInning inningHalf batterIndexInHalf",
      )
      .lean();
    if (!match) {
      return res.status(404).json({ error: "경기를 찾을 수 없습니다." });
    }

    const stadium = await StadiumModel.findOne({ id: match.stadiumId }).select("name").lean();
    const liveScoreboard = (match as { liveScoreboard?: Record<string, unknown> | null }).liveScoreboard ?? null;
    const { awayTeamName, homeTeamName } = resolveMatchTeamNames({
      apiSportsAwayTeam: match.apiSportsAwayTeam as string | null,
      apiSportsHomeTeam: match.apiSportsHomeTeam as string | null,
      liveScoreboard: liveScoreboard as never,
    });
    const headToHead = (match as { matchHeadToHead?: { awayWins?: number; homeWins?: number; season?: number } | null })
      .matchHeadToHead;

    const delayDoc = await DelayGameStateModel.findOne({ sourceMatchId: matchId }).lean();
    const delay = serializeDelayState(delayDoc as Record<string, unknown> | null);
    const roundNumber = delay?.roundNumber ?? 0;

    const myPrediction = delay
      ? serializePrediction(
          (await DelayPredictionModel.findOne({
            userId,
            sourceMatchId: matchId,
            roundNumber,
          }).lean()) as Record<string, unknown> | null,
        )
      : null;

    const lastSettledPrediction = serializePrediction(
      (await DelayPredictionModel.findOne({
        userId,
        sourceMatchId: matchId,
        status: { $in: ["won", "lost", "refunded"] },
      })
        .sort({ roundNumber: -1, createdAt: -1 })
        .lean()) as Record<string, unknown> | null,
    );

    const blocked = await hasLivePrediction(userId, matchId);

    const currentBatter = buildDelayCurrentBatter({
      startTime: match.startTime,
      inningHalf: (match as { inningHalf?: string | null }).inningHalf,
      batterIndexInHalf: (match as { batterIndexInHalf?: number | null }).batterIndexInHalf,
      matchLineup: ((match as { matchLineup?: MatchLineupSnapshot | null }).matchLineup) ?? null,
      matchPlayerStats:
        ((match as { matchPlayerStats?: Record<string, MatchPlayerStatsEntry> | null }).matchPlayerStats) ??
        null,
      pinchHitter: ((match as { pinchHitter?: PinchHitterSnapshot | null }).pinchHitter) ?? null,
      delayBatterName: delay?.batterName ?? null,
      delayHalf: delay?.lastHalf ?? null,
      liveScoreboard: liveScoreboard as LiveScoreboard | null,
    });

    res.json({
      serverNow: Date.now(),
      blocked,
      blockedMessage: blocked ? DELAY_LIVE_BLOCK_MESSAGE : null,
      match: {
        id: String(match.id),
        name: match.name,
        stadiumId: match.stadiumId,
        stadiumName: stadium?.name || "",
        startTime: match.startTime,
        matchStatus: match.matchStatus,
        registrationOrder: match.registrationOrder ?? extractMatchNumber(String(match.name || "")),
        awayTeamName,
        homeTeamName,
        headToHead: headToHead
          ? {
              awayWins: headToHead.awayWins ?? 0,
              homeWins: headToHead.homeWins ?? 0,
              season: headToHead.season,
            }
          : null,
        liveScoreboard,
      },
      currentBatter,
      delay,
      myPrediction,
      lastSettledPrediction,
    });
  } catch (error) {
    console.error("[DelayGame] state failed:", error);
    res.status(500).json({ error: "딜레이 상태를 불러오지 못했습니다." });
  }
});

router.post("/:matchId/predictions", userAuthMiddleware, async (req: AuthenticatedUserRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const matchId = String(req.params.matchId || "");
    if (!userId) {
      return res.status(401).json({ error: "인증이 필요합니다." });
    }
    if (!matchId) {
      return res.status(400).json({ error: "경기 ID가 필요합니다." });
    }

    if (await hasLivePrediction(userId, matchId)) {
      return res.status(403).json({
        error: DELAY_LIVE_BLOCK_MESSAGE,
        code: "DELAY_LIVE_BLOCKED",
      });
    }

    const prediction = req.body?.prediction;
    const amount = req.body?.amount ?? DEFAULT_BET_AMOUNT;
    if (!isDelaySuggestedResult(prediction)) {
      return res.status(400).json({ error: "허용되지 않는 예측입니다." });
    }
    if (!isValidBetAmount(amount)) {
      return res.status(400).json({ error: "허용되지 않는 배팅 금액입니다." });
    }

    const match = await MatchModel.findOne({ id: matchId }).select("id matchStatus").lean();
    if (!match) {
      return res.status(404).json({ error: "경기를 찾을 수 없습니다." });
    }
    if (!isDelayMatchOngoing(match.matchStatus)) {
      return res.status(400).json({ error: "경기가 시작된 뒤에만 딜레이 예측이 가능합니다." });
    }

    const delay = await DelayGameStateModel.findOne({ sourceMatchId: matchId }).lean();
    if (!delay || delay.phase !== "open") {
      return res.status(400).json({ error: "현재 예측이 불가능합니다. 다음 타석을 기다려주세요." });
    }
    const roundNumber = delay.roundNumber;

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const existing = await DelayPredictionModel.findOne({
        userId,
        sourceMatchId: matchId,
        roundNumber,
      })
        .session(session)
        .lean();

      if (existing) {
        if (existing.status !== "pending") {
          throw new Error("이미 결과가 확정된 예측은 변경할 수 없습니다.");
        }
        const updated = await DelayPredictionModel.findOneAndUpdate(
          { id: existing.id },
          { $set: { prediction } },
          { new: true, session },
        ).lean();
        await session.commitTransaction();
        return res.json(serializePrediction(updated as Record<string, unknown> | null));
      }

      const predId = await getNextSequence("delayPrediction");
      const [inserted] = await DelayPredictionModel.create(
        [
          {
            id: predId,
            userId,
            sourceMatchId: matchId,
            roundNumber,
            prediction,
            amount,
            status: "pending",
          },
        ],
        { session },
      );

      const updatedUser = await UserModel.findOneAndUpdate(
        { id: userId, points: { $gte: amount } },
        { $inc: { points: -amount } },
        { new: true, session },
      ).lean();

      if (!updatedUser) {
        const user = await UserModel.findOne({ id: userId }).session(session).lean();
        if (!user) throw new Error("사용자를 찾을 수 없습니다.");
        throw new Error("참여기회가 부족합니다.");
      }

      const txId = await getNextSequence("pointTransaction");
      await PointTransactionModel.create(
        [
          {
            id: txId,
            userId,
            transactionType: "spent",
            amount: -amount,
            balance: updatedUser.points,
            description: `딜레이 예측 참여 (${amount}포인트)`,
          },
        ],
        { session },
      );

      await session.commitTransaction();
      return res.json(serializePrediction(inserted.toObject() as Record<string, unknown>));
    } catch (error) {
      try {
        await session.abortTransaction();
      } catch {
        /* ignore */
      }
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    console.error("[DelayGame] prediction failed:", error);
    res.status(500).json({ error: "딜레이 예측에 실패했습니다." });
  }
});

router.post("/:matchId/ad-complete", userAuthMiddleware, async (req: AuthenticatedUserRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const matchId = String(req.params.matchId || "");
    const rewardKey = typeof req.body?.rewardKey === "string" ? req.body.rewardKey : "";
    if (!userId) {
      return res.status(401).json({ error: "인증이 필요합니다." });
    }
    if (!matchId || !rewardKey) {
      return res.status(400).json({ error: "광고 보상 키가 필요합니다." });
    }

    if (await hasLivePrediction(userId, matchId)) {
      return res.status(403).json({
        error: DELAY_LIVE_BLOCK_MESSAGE,
        code: "DELAY_LIVE_BLOCKED",
      });
    }

    const delay = await DelayGameStateModel.findOne({ sourceMatchId: matchId }).lean();
    if (!delay || delay.adRewardKey !== rewardKey) {
      return res.status(400).json({ error: "현재 보상할 딜레이 광고가 없습니다." });
    }

    const result = await grantDelayAdRewardPoints(userId, matchId, rewardKey);
    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    console.error("[DelayGame] ad reward failed:", error);
    res.status(500).json({ error: "딜레이 광고 보상에 실패했습니다." });
  }
});

export default router;
