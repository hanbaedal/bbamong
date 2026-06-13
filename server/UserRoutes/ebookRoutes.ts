import type { Express } from "express";
import { EbookStorage } from "../UserStorage/ebookStorage";
import { PointStorage } from "../UserStorage/pointStorage";
import { db } from "../UserStorage/db";
import { users, ebookPurchases, ebooks, predictions, pointTransactions } from "@shared/schema";
import { eq, and, sql, sum } from "drizzle-orm";
import { userAuthMiddleware, type AuthenticatedUserRequest } from "../middleware/userAuth";

const ebookStorage = new EbookStorage();
const pointStorage = new PointStorage();

export async function ebookRoutes(app: Express): Promise<void> {
  // 모든 전자책 조회
  app.get("/api/ebooks", async (req, res) => {
    try {
      const ebooks = await ebookStorage.getAllEbooks();
      return res.json(ebooks);
    } catch (error) {
      console.error("Get ebooks error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 특정 전자책 조회
  app.get("/api/ebooks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: "전자책 ID가 유효하지 않습니다." });
      }

      const ebook = await ebookStorage.getEbook(id);
      if (!ebook) {
        return res.status(404).json({ error: "전자책을 찾을 수 없습니다." });
      }

      return res.json(ebook);
    } catch (error) {
      console.error("Get ebook error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 사용자의 누적 기부 포인트 조회
  app.get("/api/users/:userId/donated-points", userAuthMiddleware, async (req: AuthenticatedUserRequest, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ error: "사용자 ID가 필요합니다." });
      }

      // 본인의 기부 포인트만 조회 가능
      if (req.user?.userId !== userId) {
        return res.status(403).json({ error: "본인의 기부 포인트만 조회할 수 있습니다." });
      }

      const result = await db
        .select({
          totalDonated: sql<number>`COALESCE(SUM(ABS(${pointTransactions.amount})), 0)`,
        })
        .from(pointTransactions)
        .where(
          and(
            eq(pointTransactions.userId, userId),
            eq(pointTransactions.transactionType, "donation")
          )
        );

      const totalDonated = Number(result[0]?.totalDonated) || 0;

      // 사용자가 전자책 구매에 사용한 포인트 계산 (ebookPurchases + ebooks 조인)
      const spentResult = await db
        .select({
          totalSpent: sum(ebooks.price),
        })
        .from(ebookPurchases)
        .innerJoin(ebooks, eq(ebookPurchases.ebookId, ebooks.id))
        .where(eq(ebookPurchases.userId, userId));

      const totalSpent = Number(spentResult[0]?.totalSpent) || 0;

      // 사용 가능한 기부 포인트 = 총 기부 포인트 - 사용한 포인트
      const availableDonatedPoints = Math.max(0, totalDonated - totalSpent);

      return res.json({
        totalDonated,
        totalSpent,
        availableDonatedPoints,
      });
    } catch (error) {
      console.error("Get donated points error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 전자책 생성 (관리자용)
  app.post("/api/ebooks", async (req, res) => {
    try {
      const { name, price } = req.body;

      if (!name || typeof price !== "number") {
        return res.status(400).json({ error: "전자책 정보가 부족합니다." });
      }

      const newEbook = await ebookStorage.createEbook({ name, price });
      return res.status(201).json(newEbook);
    } catch (error) {
      console.error("Create ebook error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 특정 사용자의 전자책 구매내역 조회
  app.get("/api/ebook-purchases/user/:userId", userAuthMiddleware, async (req: AuthenticatedUserRequest, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ error: "사용자 ID가 필요합니다." });
      }

      // 본인의 구매내역만 조회 가능
      if (req.user?.userId !== userId) {
        return res.status(403).json({ error: "본인의 구매내역만 조회할 수 있습니다." });
      }

      const purchases = await ebookStorage.getUserPurchases(userId);
      return res.json(purchases);
    } catch (error) {
      console.error("Get user purchases error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 전자책 구매 (포인트 차감 포함)
  app.post("/api/ebook-purchases", userAuthMiddleware, async (req: AuthenticatedUserRequest, res) => {
    try {
      const { ebookId } = req.body;

      if (typeof ebookId !== "number") {
        return res.status(400).json({ error: "전자책 ID가 필요합니다." });
      }

      // 인증된 사용자의 userId 사용 (보안 개선)
      const userId = req.user!.userId;

      // 전자책 정보 조회
      const ebook = await ebookStorage.getEbook(ebookId);
      if (!ebook) {
        return res.status(404).json({ error: "전자책을 찾을 수 없습니다." });
      }

      // 데이터베이스 트랜잭션으로 모든 작업 묶기 (동시성 문제 방지)
      const result = await db.transaction(async (tx) => {
        // 사용자의 현재 포인트 조회 (FOR UPDATE로 락 걸어서 동시성 문제 방지)
        const userResult = await tx.execute<{ points: number }>(
          sql`SELECT points FROM ${users} WHERE ${users.id} = ${userId} FOR UPDATE`
        );

        if (!userResult || userResult.length === 0) {
          throw new Error("사용자를 찾을 수 없습니다.");
        }

        // 사용자의 현재 일반 포인트 (users.points)
        const currentUserPoints = (userResult as any)[0]?.points ?? 0;

        const donatedResult = await tx
          .select({
            totalDonated: sql<number>`COALESCE(SUM(ABS(${pointTransactions.amount})), 0)`,
          })
          .from(pointTransactions)
          .where(
            and(
              eq(pointTransactions.userId, userId),
              eq(pointTransactions.transactionType, "donation")
            )
          );

        const totalDonated = Number(donatedResult[0]?.totalDonated) || 0;

        // 사용자가 전자책 구매에 사용한 포인트 계산 (ebookPurchases + ebooks 조인)
        const spentResult = await tx
          .select({
            totalSpent: sum(ebooks.price),
          })
          .from(ebookPurchases)
          .innerJoin(ebooks, eq(ebookPurchases.ebookId, ebooks.id))
          .where(eq(ebookPurchases.userId, userId));

        const totalSpent = Number(spentResult[0]?.totalSpent) || 0;
        const availableDonatedPoints = Math.max(0, totalDonated - totalSpent);

        // 기부 포인트 부족 확인
        if (availableDonatedPoints < ebook.price) {
          throw new Error(`기부 포인트가 부족합니다. (필요: ${ebook.price}P, 사용 가능: ${availableDonatedPoints}P)`);
        }

        const remainingDonatedPoints = availableDonatedPoints - ebook.price;

        // 구매 내역 추가
        const purchaseResult = await tx
          .insert(ebookPurchases)
          .values({
            userId,
            ebookId,
          })
          .returning();

        // pointTransactions에 기부 포인트 사용 기록 추가 (users.points는 변경하지 않음)
        // balance는 현재 users.points 값을 유지 (일반 포인트는 변경되지 않음)
        await tx.insert(pointTransactions).values({
          userId,
          transactionType: "donated_spent",
          amount: -ebook.price,
          balance: currentUserPoints,
          description: `${ebook.name} 구매 (기부 포인트 사용)`,
        });

        return {
          purchase: purchaseResult[0],
          remainingDonatedPoints,
        };
      });

      return res.status(201).json({
        success: true,
        purchase: result.purchase,
        remainingDonatedPoints: result.remainingDonatedPoints,
      });
    } catch (error: any) {
      console.error("Purchase ebook error:", error);
      
      // 비즈니스 로직 에러는 400으로 반환
      if (error.message?.includes("포인트가 부족")) {
        return res.status(400).json({ error: error.message });
      }
      
      if (error.message?.includes("찾을 수 없습니다")) {
        return res.status(404).json({ error: error.message });
      }
      
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}
