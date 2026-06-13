import type { Express } from "express";
import { EbookStorage } from "../UserStorage/ebookStorage";
import {
  mongoose,
  UserModel,
  PointTransactionModel,
  EbookPurchaseModel,
  getNextSequence,
} from "../UserStorage/db";
import { userAuthMiddleware, type AuthenticatedUserRequest } from "../middleware/userAuth";

const ebookStorage = new EbookStorage();

async function getDonatedPointsSummary(userId: string) {
  const [donatedAgg, spentAgg] = await Promise.all([
    PointTransactionModel.aggregate<{ totalDonated: number }>([
      { $match: { userId, transactionType: "donation" } },
      { $group: { _id: null, totalDonated: { $sum: { $abs: "$amount" } } } },
    ]),
    EbookPurchaseModel.aggregate<{ totalSpent: number }>([
      { $match: { userId } },
      { $lookup: { from: "ebooks", localField: "ebookId", foreignField: "id", as: "ebook" } },
      { $unwind: "$ebook" },
      { $group: { _id: null, totalSpent: { $sum: "$ebook.price" } } },
    ]),
  ]);

  const totalDonated = donatedAgg[0]?.totalDonated || 0;
  const totalSpent = spentAgg[0]?.totalSpent || 0;
  const availableDonatedPoints = Math.max(0, totalDonated - totalSpent);

  return { totalDonated, totalSpent, availableDonatedPoints };
}

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

      if (req.user?.userId !== userId) {
        return res.status(403).json({ error: "본인의 기부 포인트만 조회할 수 있습니다." });
      }

      const summary = await getDonatedPointsSummary(userId);

      return res.json(summary);
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

      const userId = req.user!.userId;

      const ebook = await ebookStorage.getEbook(ebookId);
      if (!ebook) {
        return res.status(404).json({ error: "전자책을 찾을 수 없습니다." });
      }

      const session = await mongoose.startSession();
      let result: { purchase: Awaited<ReturnType<EbookStorage["purchaseEbook"]>>; remainingDonatedPoints: number };

      try {
        session.startTransaction();

        const user = await UserModel.findOne({ id: userId }).session(session).lean();
        if (!user) {
          throw new Error("사용자를 찾을 수 없습니다.");
        }

        const currentUserPoints = user.points ?? 0;

        const donatedAgg = await PointTransactionModel.aggregate<{ totalDonated: number }>([
          { $match: { userId, transactionType: "donation" } },
          { $group: { _id: null, totalDonated: { $sum: { $abs: "$amount" } } } },
        ]).session(session);

        const totalDonated = donatedAgg[0]?.totalDonated || 0;

        const spentAgg = await EbookPurchaseModel.aggregate<{ totalSpent: number }>([
          { $match: { userId } },
          { $lookup: { from: "ebooks", localField: "ebookId", foreignField: "id", as: "ebook" } },
          { $unwind: "$ebook" },
          { $group: { _id: null, totalSpent: { $sum: "$ebook.price" } } },
        ]).session(session);

        const totalSpent = spentAgg[0]?.totalSpent || 0;
        const availableDonatedPoints = Math.max(0, totalDonated - totalSpent);

        if (availableDonatedPoints < ebook.price) {
          throw new Error(`기부 포인트가 부족합니다. (필요: ${ebook.price}P, 사용 가능: ${availableDonatedPoints}P)`);
        }

        const existingPurchase = await EbookPurchaseModel.findOne({ userId, ebookId }).session(session).lean();
        if (existingPurchase) {
          throw new Error("이미 구매한 전자책입니다.");
        }

        const remainingDonatedPoints = availableDonatedPoints - ebook.price;
        const purchaseId = await getNextSequence("ebookPurchase");
        const [purchaseDoc] = await EbookPurchaseModel.create(
          [{ id: purchaseId, userId, ebookId }],
          { session },
        );

        const txId = await getNextSequence("pointTransaction");
        await PointTransactionModel.create(
          [
            {
              id: txId,
              userId,
              transactionType: "donated_spent",
              amount: -ebook.price,
              balance: currentUserPoints,
              description: `${ebook.name} 구매 (기부 포인트 사용)`,
            },
          ],
          { session },
        );

        result = {
          purchase: purchaseDoc.toObject(),
          remainingDonatedPoints,
        };

        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }

      return res.status(201).json({
        success: true,
        purchase: result.purchase,
        remainingDonatedPoints: result.remainingDonatedPoints,
      });
    } catch (error: any) {
      console.error("Purchase ebook error:", error);

      if (error.message?.includes("포인트가 부족") || error.message?.includes("이미 구매")) {
        return res.status(400).json({ error: error.message });
      }

      if (error.message?.includes("찾을 수 없습니다")) {
        return res.status(404).json({ error: error.message });
      }

      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}
