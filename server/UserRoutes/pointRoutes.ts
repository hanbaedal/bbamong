// pointRoutes.ts
import type { Express } from "express";
import { PointStorage } from "../UserStorage/pointStorage";

const pointStorage = new PointStorage(); // 인스턴스 생성

export async function pointRoutes(app: Express): Promise<void> {
  // 특정 사용자 거래 내역 조회 (페이지네이션)
  app.get("/api/point-transactions/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      if (!userId) {
        return res.status(400).json({ error: "사용자 ID가 필요합니다." });
      }

      const transactions = await pointStorage.getTransactionsByUser(userId, limit, offset);
      return res.json(transactions);
    } catch (error) {
      console.error("Get point transactions error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 새로운 포인트 거래 추가
  app.post("/api/point-transactions", async (req, res) => {
    try {
      const transaction = req.body;

      if (!transaction.userId || typeof transaction.amount !== "number" || !transaction.transactionType || !transaction.description) {
        return res.status(400).json({ error: "거래 정보가 부족합니다." });
      }

      const newTransaction = await pointStorage.addTransaction(transaction);
      return res.status(201).json(newTransaction);
    } catch (error) {
      console.error("Add point transaction error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 특정 거래 조회
  app.get("/api/point-transaction/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: "거래 ID가 유효하지 않습니다." });
      }

      const transaction = await pointStorage.getTransaction(id);
      if (!transaction) return res.status(404).json({ error: "거래를 찾을 수 없습니다." });

      return res.json(transaction);
    } catch (error) {
      console.error("Get point transaction error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 특정 사용자 총 포인트 조회
  app.get("/api/total-points/:userId", async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId) return res.status(400).json({ error: "사용자 ID가 필요합니다." });

      const totalPoints = await pointStorage.getTotalPoints(userId);
      return res.json({ userId, totalPoints });
    } catch (error) {
      console.error("Get total points error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 거래 삭제
  app.delete("/api/point-transaction/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) return res.status(400).json({ error: "거래 ID가 유효하지 않습니다." });

      const result = await pointStorage.deleteTransaction(id);
      return res.json(result);
    } catch (error) {
      console.error("Delete point transaction error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/donations/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!userId) {
        return res.status(400).json({ error: "사용자 ID가 필요합니다." });
      }

      const { donations, totalAmount, totalCount } =
        await pointStorage.getDonationsByUser(userId, page, limit);

      return res.json({
        success: true,
        totalAmount,
        totalCount,
        page,
        limit,
        donations,
      });
    } catch (error) {
      console.error("Get donations by user error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/donations/user/:userId/rank", async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ error: "사용자 ID가 필요합니다." });
      }

      const { rank, totalAmount } = await pointStorage.getDonationRankByUser(userId);

      return res.json({
        success: true,
        rank,
        totalAmount,
      });
    } catch (error) {
      console.error("Get donation rank error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}
