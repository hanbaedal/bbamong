import { Router, Request, Response } from "express";
import { broadcastManager } from "./broadcastManager";
import { 
  getMatchInfo,
  getPredictionsByMatchAndRound,
  getRoundStatistics,
  getAllRoundStatistics,
  getMatchOverallStatistics,
  getRoundDetailsWithStatistics,
  endMatch,
} from "./predictionStorage";
import { requireAdmin } from "./authMiddleware";
import { adminAuthMiddleware } from "../middleware/adminAuth";

const router = Router();

// Apply JWT authentication to all /control routes
router.use("/control", adminAuthMiddleware);

// ===== 관리자 전용 엔드포인트 =====

router.post("/control/:matchId/end", requireAdmin, async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId;

    const match = await endMatch(matchId);

    broadcastManager.sendToMatch(matchId, "end", {
      matchId,
      message: "경기가 종료되었습니다.",
      matchStatus: match.matchStatus,
    });

    res.json({ 
      success: true, 
      message: "경기가 종료되었습니다.",
      match,
      clientCount: broadcastManager.getClientCount(matchId)
    });
  } catch (error) {
    console.error("Error ending match:", error);
    res.status(500).json({ error: "경기 종료에 실패했습니다." });
  }
});

router.post("/control/:matchId/update", requireAdmin, async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId;
    const { message, data } = req.body;

    broadcastManager.sendToMatch(matchId, "update", {
      message,
      data,
    });

    res.json({ 
      success: true, 
      message: "업데이트가 전송되었습니다.",
      clientCount: broadcastManager.getClientCount(matchId)
    });
  } catch (error) {
    console.error("Error sending update:", error);
    res.status(500).json({ error: "업데이트 전송에 실패했습니다." });
  }
});

// ===== 통계 조회 엔드포인트 (관리자 전용) =====

router.get("/control/:matchId/round/stats", requireAdmin, async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId;
    
    const match = await getMatchInfo(matchId);
    if (!match) {
      return res.status(404).json({ error: "경기를 찾을 수 없습니다." });
    }

    const stats = await getRoundStatistics(matchId, match.currentRound);
    
    const currentPredictions = await getPredictionsByMatchAndRound(matchId, match.currentRound);
    const liveStats = {
      totalParticipants: currentPredictions.length,
      totalPoints: currentPredictions.reduce((sum, p) => sum + p.amount, 0),
    };

    res.json({
      currentRound: match.currentRound,
      predictionEnabled: match.predictionEnabled,
      savedStats: stats || null,
      liveStats,
    });
  } catch (error) {
    console.error("Error getting round stats:", error);
    res.status(500).json({ error: "라운드 통계 조회에 실패했습니다." });
  }
});

router.get("/control/:matchId/stats", requireAdmin, async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId;
    
    const match = await getMatchInfo(matchId);
    if (!match) {
      return res.status(404).json({ error: "경기를 찾을 수 없습니다." });
    }

    const allStats = await getAllRoundStatistics(matchId);
    const overallStats = await getMatchOverallStatistics(matchId);
    
    res.json({
      matchId,
      currentRound: match.currentRound,
      predictionEnabled: match.predictionEnabled,
      roundStatistics: allStats,
      overallStats,
    });
  } catch (error) {
    console.error("Error getting match stats:", error);
    res.status(500).json({ error: "경기 통계 조회에 실패했습니다." });
  }
});

router.get("/control/:matchId/round-details", requireAdmin, async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId;
    
    const match = await getMatchInfo(matchId);
    if (!match) {
      return res.status(404).json({ error: "경기를 찾을 수 없습니다." });
    }

    const roundDetails = await getRoundDetailsWithStatistics(matchId);
    
    res.json({
      matchId,
      currentRound: match.currentRound,
      predictionEnabled: match.predictionEnabled,
      roundDetails,
    });
  } catch (error) {
    console.error("Error getting round details:", error);
    res.status(500).json({ error: "라운드 상세 정보 조회에 실패했습니다." });
  }
});

export default router;
