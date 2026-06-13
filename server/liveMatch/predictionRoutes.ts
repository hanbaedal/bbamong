import { Router, Request, Response } from "express";
import { broadcastManager } from "./broadcastManager";
import {
  createPredictionWithPointDeduction,
  updatePredictionChoice,
  cancelPredictionAndRefundPoints,
  getUserPredictionForMatch,
  getMatchInfo,
  getPredictionsByMatchAndRound,
  getMatchOverallStatistics,
  getUserPendingPrediction,
  getRoundStatistics,
  getUserPredictionByMatchRound,
} from "./predictionStorage";
import { insertPredictionSchema } from "@shared/schema";
import { z } from "zod";
import { db } from "../UserStorage/db";
import { predictions, users, pointTransactions } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { userAuthMiddleware } from "../middleware/userAuth";

const router = Router();

router.post("/predictions", userAuthMiddleware, async (req: any, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: "인증이 필요합니다." });
    }

    const validatedData = insertPredictionSchema.omit({ userId: true }).parse(req.body);
    
    const match = await getMatchInfo(validatedData.matchId);
    if (!match) {
      return res.status(404).json({ error: "경기를 찾을 수 없습니다." });
    }

    // 경기 상태 확인 - 취소되거나 종료된 경기는 예측 불가
    if (match.matchStatus === "취소") {
      return res.status(400).json({ 
        error: "취소된 경기입니다. 예측할 수 없습니다." 
      });
    }

    if (match.matchStatus === "종료") {
      return res.status(400).json({ 
        error: "종료된 경기입니다. 예측할 수 없습니다." 
      });
    }

    if (!match.predictionEnabled) {
      return res.status(400).json({ 
        error: "현재 예측이 불가능합니다. 예측 시작을 기다려주세요." 
      });
    }

    const currentRound = match.currentRound;
    
    const roundPredictions = await getPredictionsByMatchAndRound(
      validatedData.matchId,
      currentRound
    );
    
    const existingPrediction = roundPredictions.find(
      p => p.userId === userId
    );

    const amount = validatedData.amount ?? 100;

    let prediction;
    if (existingPrediction) {
      prediction = await updatePredictionChoice(
        existingPrediction.id,
        validatedData.prediction
      );
    } else {
      prediction = await createPredictionWithPointDeduction({
        ...validatedData,
        userId,
        roundNumber: currentRound,
        amount,
      });
    }

    const overallStats = await getMatchOverallStatistics(validatedData.matchId);
    
    broadcastManager.sendToMatch(validatedData.matchId, "stats_update", {
      overallStats,
      message: "통계가 업데이트되었습니다.",
    });

    res.json(prediction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Error creating prediction:", error);
    res.status(500).json({ error: "예측 생성에 실패했습니다." });
  }
});

router.post("/predictions/:id/cancel", userAuthMiddleware, async (req: any, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: "인증이 필요합니다." });
    }

    const predictionId = parseInt(req.params.id);
    if (isNaN(predictionId)) {
      return res.status(400).json({ error: "잘못된 예측 ID입니다." });
    }

    await cancelPredictionAndRefundPoints(predictionId, userId);

    res.json({ success: true, message: "예측이 취소되었습니다." });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Error cancelling prediction:", error);
    res.status(500).json({ error: "예측 취소에 실패했습니다." });
  }
});

router.get("/predictions/:matchId/check", userAuthMiddleware, async (req: any, res: Response) => {
  try {
    const matchId = req.params.matchId;
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: "인증이 필요합니다." });
    }
    
    const match = await getMatchInfo(matchId);
    if (!match) {
      return res.status(404).json({ error: "경기를 찾을 수 없습니다." });
    }

    const currentRound = match.currentRound;
    
    const roundPredictions = await getPredictionsByMatchAndRound(matchId, currentRound);
    const userPrediction = roundPredictions.find(p => p.userId === userId);

    if (userPrediction) {
      return res.json({
        hasPrediction: true,
        predictionId: userPrediction.id,
        prediction: userPrediction.prediction,
        amount: userPrediction.amount,
        roundNumber: currentRound,
        status: userPrediction.status,
        wonAmount: userPrediction.wonAmount ?? 0,
        predictionEnabled: match.predictionEnabled,
      });
    }

    // No prediction found for the current round — find the latest resolved prediction
    // across all rounds in case multiple rounds advanced while the user was away.
    const { getLatestResolvedPredictionForMatch } = await import("./predictionStorage");
    const resolvedPrediction = await getLatestResolvedPredictionForMatch(userId, matchId);
    if (resolvedPrediction) {
      return res.json({
        hasPrediction: true,
        predictionId: resolvedPrediction.id,
        prediction: resolvedPrediction.prediction,
        amount: resolvedPrediction.amount,
        roundNumber: resolvedPrediction.roundNumber,
        status: resolvedPrediction.status,
        wonAmount: resolvedPrediction.wonAmount ?? 0,
        predictionEnabled: match.predictionEnabled,
        fromPreviousRound: true,
      });
    }

    return res.json({
      hasPrediction: false,
      roundNumber: currentRound,
      predictionEnabled: match.predictionEnabled,
    });
  } catch (error) {
    console.error("Error checking user prediction:", error);
    res.status(500).json({ error: "예측 확인에 실패했습니다." });
  }
});

router.get("/predictions/pending", userAuthMiddleware, async (req: any, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: "인증이 필요합니다." });
    }
    
    const pendingPrediction = await getUserPendingPrediction(userId);

    if (pendingPrediction) {
      return res.json({
        hasPending: true,
        predictionId: pendingPrediction.id,
        prediction: pendingPrediction.prediction,
        amount: pendingPrediction.amount,
        matchId: pendingPrediction.matchId,
        roundNumber: pendingPrediction.roundNumber,
        match: pendingPrediction.match,
      });
    } else {
      return res.json({
        hasPending: false,
      });
    }
  } catch (error) {
    console.error("Error getting user pending prediction:", error);
    res.status(500).json({ error: "대기 중인 예측 조회에 실패했습니다." });
  }
});

// 예측 조회 API (기부 금액 확인용)
router.get("/predictions/:id", userAuthMiddleware, async (req: any, res: Response) => {
  try {
    const predictionId = parseInt(req.params.id);
    const userId = req.user?.userId;
    
    if (isNaN(predictionId)) {
      return res.status(400).json({ error: "잘못된 예측 ID입니다." });
    }

    if (!userId) {
      return res.status(401).json({ error: "인증이 필요합니다." });
    }

    const [prediction] = await db
      .select()
      .from(predictions)
      .where(eq(predictions.id, predictionId));
    
    if (!prediction) {
      return res.status(404).json({ error: "예측을 찾을 수 없습니다." });
    }

    // 본인의 예측만 조회 가능
    if (prediction.userId !== userId) {
      return res.status(403).json({ error: "본인의 예측만 조회할 수 있습니다." });
    }

    // 기부 가능 금액 계산
    const prize = prediction.wonAmount - prediction.amount;
    const donationAmount = Math.round(prize * 0.1);

    return res.json({
      ...prediction,
      prize,
      donationAmount,
    });
  } catch (error) {
    console.error("Get prediction error:", error);
    return res.status(500).json({ error: "예측 조회에 실패했습니다." });
  }
});

// 기부 API
router.post("/predictions/:id/donate", userAuthMiddleware, async (req: any, res: Response) => {
  try {
    const predictionId = parseInt(req.params.id);
    const userId = req.user?.userId; // 인증된 사용자 ID
    
    if (isNaN(predictionId)) {
      return res.status(400).json({ error: "잘못된 예측 ID입니다." });
    }

    if (!userId) {
      return res.status(401).json({ error: "인증이 필요합니다." });
    }

    // 1. 예측 조회
    const [prediction] = await db
      .select()
      .from(predictions)
      .where(eq(predictions.id, predictionId));
    
    if (!prediction) {
      return res.status(404).json({ error: "예측을 찾을 수 없습니다." });
    }

    // 2. 인증 체크 - 예측 소유자만 기부 가능
    if (prediction.userId !== userId) {
      return res.status(403).json({ error: "본인의 예측만 기부할 수 있습니다." });
    }

    // 3. 검증
    if (prediction.status !== 'success') {
      return res.status(400).json({ error: "예측이 성공하지 않았습니다." });
    }

    if (prediction.wonAmount <= 0) {
      return res.status(400).json({ error: "승리 포인트가 없습니다." });
    }

    if (prediction.donatedAmount > 0) {
      return res.status(400).json({ error: "이미 기부하셨습니다." });
    }

    // 3. 기부 금액 계산 (상금의 10% 반올림)
    // 상금 = wonAmount - 원금(amount)
    const prize = prediction.wonAmount - prediction.amount;
    const donationAmount = Math.round(prize * 0.1);

    // 4. 유저 포인트 확인
    const [user] = await db
      .select({ points: users.points })
      .from(users)
      .where(eq(users.id, prediction.userId));

    // 기부 금액이 0이면 기부하지 않고 성공 반환
    if (donationAmount <= 0) {
      return res.json({
        success: true,
        message: "기부 금액이 없습니다.",
        donationAmount: 0,
        remainingPoints: user?.points || 0,
      });
    }
    
    if (!user) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    }

    if (user.points < donationAmount) {
      return res.status(400).json({ error: "참여기회가 부족합니다." });
    }

    // 5. 트랜잭션으로 포인트 차감 및 기부 내역 기록
    await db.transaction(async (tx: any) => {
      // 유저 포인트 차감
      await tx.execute(
        sql`UPDATE users SET points = points - ${donationAmount} WHERE id = ${prediction.userId}`
      );

      // totalDonationAmount 업데이트
      await tx.execute(
        sql`UPDATE users SET total_donation_amount = total_donation_amount + ${donationAmount} WHERE id = ${prediction.userId}`
      );

      // 잔액 조회
      const [updatedUser] = await tx
        .select({ points: users.points })
        .from(users)
        .where(eq(users.id, prediction.userId));

      // 거래 내역 기록
      if (updatedUser) {
        await tx.insert(pointTransactions).values({
          userId: prediction.userId,
          transactionType: 'donation',
          amount: -donationAmount,
          balance: updatedUser.points,
          description: `예측 승리 포인트 기부 (${donationAmount}포인트)`,
        });
      }

      // donatedAmount 업데이트
      await tx
        .update(predictions)
        .set({ donatedAmount: donationAmount })
        .where(eq(predictions.id, predictionId));
    });

    res.json({
      success: true,
      message: "기부가 완료되었습니다.",
      donationAmount,
      remainingPoints: user.points - donationAmount,
    });
  } catch (error) {
    console.error("Error processing donation:", error);
    res.status(500).json({ error: "기부 처리에 실패했습니다." });
  }
});

export default router;
