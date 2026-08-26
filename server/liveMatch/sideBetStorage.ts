import {
  mongoose,
  UserModel,
  MatchModel,
  MatchSideBetModel,
  PointTransactionModel,
  getNextSequence,
} from "../UserStorage/db";
import type { ClientSession } from "mongoose";
import {
  calculateSideBetPayout,
  getSideBetOdds,
  isValidSideBetAmount,
  type SideBetType,
  type WinnerSide,
} from "@shared/predictionOdds";
import { isApiSyncEnabledForRegistrationOrder } from "../managerOperatorService";

const CLOSED_MATCH_STATUSES = new Set(["completed", "cancelled", "종료", "취소"]);

async function createPointTransaction(
  session: ClientSession,
  data: {
    userId: string;
    transactionType: string;
    amount: number;
    balance: number;
    description: string;
  },
) {
  const id = await getNextSequence("pointTransaction");
  await PointTransactionModel.create([{ id, ...data }], { session });
}

function isMatchClosedForSideBets(matchStatus: string): boolean {
  return CLOSED_MATCH_STATUSES.has(matchStatus);
}

export async function getUserSideBetsForMatch(userId: string, matchId: string) {
  const docs = await MatchSideBetModel.find({ userId, matchId }).lean();
  return docs;
}

export async function getSideBetSummaryForMatch(matchId: string) {
  const bets = await MatchSideBetModel.find({ matchId }).lean();
  const summary = {
    winner: { count: 0, totalPoints: 0, home: 0, away: 0 },
    score: { count: 0, totalPoints: 0 },
    pending: 0,
    won: 0,
    lost: 0,
    refunded: 0,
  };

  for (const bet of bets) {
    if (bet.status === "pending") summary.pending += 1;
    if (bet.status === "won") summary.won += 1;
    if (bet.status === "lost") summary.lost += 1;
    if (bet.status === "refunded") summary.refunded += 1;

    if (bet.type === "winner") {
      summary.winner.count += 1;
      summary.winner.totalPoints += bet.amount;
      if (bet.winnerPick === "home") summary.winner.home += 1;
      if (bet.winnerPick === "away") summary.winner.away += 1;
    } else if (bet.type === "score") {
      summary.score.count += 1;
      summary.score.totalPoints += bet.amount;
    }
  }

  return summary;
}

export async function lockSideBetsForMatch(matchId: string): Promise<boolean> {
  const result = await MatchModel.updateOne(
    { id: matchId, sideBetsLocked: { $ne: true } },
    { sideBetsLocked: true },
  );
  return result.modifiedCount > 0;
}

export async function upsertSideBet(params: {
  userId: string;
  matchId: string;
  type: SideBetType;
  amount: number;
  winnerPick?: WinnerSide;
  homeScorePick?: number;
  awayScorePick?: number;
}) {
  const { userId, matchId, type, amount } = params;

  if (!isValidSideBetAmount(amount)) {
    throw new Error("사이드 배팅은 100·200·300·500·700·1000P만 가능합니다.");
  }

  if (type === "winner") {
    if (params.winnerPick !== "home" && params.winnerPick !== "away") {
      throw new Error("승리팀을 선택해주세요.");
    }
  } else {
    const home = params.homeScorePick;
    const away = params.awayScorePick;
    if (
      home === undefined ||
      away === undefined ||
      !Number.isInteger(home) ||
      !Number.isInteger(away) ||
      home < 0 ||
      away < 0 ||
      home > 30 ||
      away > 30
    ) {
      throw new Error("유효한 최종 스코어를 입력해주세요. (0~30)");
    }
  }

  const match = await MatchModel.findOne({ id: matchId }).lean();
  if (!match) throw new Error("경기를 찾을 수 없습니다.");
  if (isMatchClosedForSideBets(match.matchStatus)) {
    throw new Error("종료·취소된 경기에는 배팅할 수 없습니다.");
  }
  if (match.sideBetsLocked) {
    throw new Error("1회 시작으로 배팅이 마감되었습니다.");
  }

  const registrationOrder =
    (match as { registrationOrder?: number | null }).registrationOrder ??
    (() => {
      const num = String(match.name).match(/\d+/);
      return num ? parseInt(num[0]!, 10) : 0;
    })();
  const sideBetEnabled = await isApiSyncEnabledForRegistrationOrder(registrationOrder);
  if (!sideBetEnabled) {
    throw new Error("이 경기는 아직 배팅을 받지 않습니다.");
  }

  const existing = await MatchSideBetModel.findOne({ userId, matchId, type }).lean();

  if (existing) {
    if (existing.status !== "pending") {
      throw new Error("이미 정산된 배팅은 변경할 수 없습니다.");
    }

    const prevAmount = existing.amount;
    const delta = amount - prevAmount;
    const pickUpdate = {
      winnerPick: type === "winner" ? params.winnerPick : null,
      homeScorePick: type === "score" ? params.homeScorePick : null,
      awayScorePick: type === "score" ? params.awayScorePick : null,
      amount,
    };

    if (delta === 0) {
      const updated = await MatchSideBetModel.findOneAndUpdate(
        { id: existing.id },
        pickUpdate,
        { new: true },
      ).lean();
      return updated;
    }

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      if (delta > 0) {
        const updatedUser = await UserModel.findOneAndUpdate(
          { id: userId, points: { $gte: delta } },
          { $inc: { points: -delta } },
          { new: true, session },
        ).lean();
        if (!updatedUser) {
          const user = await UserModel.findOne({ id: userId }).session(session).lean();
          if (!user) throw new Error("사용자를 찾을 수 없습니다.");
          throw new Error("참여기회가 부족합니다.");
        }
        const label = type === "winner" ? "승리팀" : "최종 스코어";
        await createPointTransaction(session, {
          userId,
          transactionType: "spent",
          amount: -delta,
          balance: updatedUser.points,
          description: `${label} 맞추기 배팅 금액 변경 (+${delta}포인트)`,
        });
      } else {
        const refund = -delta;
        const updatedUser = await UserModel.findOneAndUpdate(
          { id: userId },
          { $inc: { points: refund } },
          { new: true, session },
        ).lean();
        if (!updatedUser) throw new Error("사용자를 찾을 수 없습니다.");
        const label = type === "winner" ? "승리팀" : "최종 스코어";
        await createPointTransaction(session, {
          userId,
          transactionType: "refund",
          amount: refund,
          balance: updatedUser.points,
          description: `${label} 맞추기 배팅 금액 변경 환불 (${refund}포인트)`,
        });
      }

      const updated = await MatchSideBetModel.findOneAndUpdate(
        { id: existing.id },
        pickUpdate,
        { new: true, session },
      ).lean();

      await session.commitTransaction();
      return updated;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const betId = await getNextSequence("matchSideBet");
    const odds = getSideBetOdds(type);
    const [inserted] = await MatchSideBetModel.create(
      [
        {
          id: betId,
          userId,
          matchId,
          type,
          winnerPick: type === "winner" ? params.winnerPick : null,
          homeScorePick: type === "score" ? params.homeScorePick : null,
          awayScorePick: type === "score" ? params.awayScorePick : null,
          amount,
          odds,
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

    const label = type === "winner" ? "승리팀" : "최종 스코어";
    await createPointTransaction(session, {
      userId,
      transactionType: "spent",
      amount: -amount,
      balance: updatedUser.points,
      description: `${label} 맞추기 배팅 (${amount}포인트)`,
    });

    await session.commitTransaction();
    return inserted.toObject();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

async function refundSingleSideBet(
  bet: {
    id: number;
    userId: string;
    amount: number;
    type: string;
  },
  session: ClientSession,
  reason: string,
) {
  const updatedUser = await UserModel.findOneAndUpdate(
    { id: bet.userId },
    { $inc: { points: bet.amount } },
    { new: true, session },
  ).lean();

  if (updatedUser) {
    await createPointTransaction(session, {
      userId: bet.userId,
      transactionType: "refund",
      amount: bet.amount,
      balance: updatedUser.points,
      description: reason,
    });
  }

  await MatchSideBetModel.updateOne(
    { id: bet.id },
    { status: "refunded", wonAmount: 0 },
    { session },
  );
}

export async function refundSideBetsForMatch(matchId: string): Promise<number> {
  const pending = await MatchSideBetModel.find({ matchId, status: "pending" }).lean();
  if (pending.length === 0) return 0;

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    for (const bet of pending) {
      await refundSingleSideBet(bet, session, `경기 취소·무효 환불 (${bet.amount}포인트)`);
    }
    await session.commitTransaction();
    return pending.length;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function settleMatchSideBets(
  matchId: string,
  homeScore: number,
  awayScore: number,
): Promise<{ settled: number; refunded: number }> {
  const pending = await MatchSideBetModel.find({ matchId, status: "pending" }).lean();
  if (pending.length === 0) return { settled: 0, refunded: 0 };

  const winnerSide: WinnerSide | "tie" =
    homeScore > awayScore ? "home" : awayScore > homeScore ? "away" : "tie";

  const session = await mongoose.startSession();
  let settled = 0;
  let refunded = 0;

  try {
    session.startTransaction();

    for (const bet of pending) {
      if (bet.type === "winner") {
        if (winnerSide === "tie") {
          await refundSingleSideBet(bet, session, `승리팀 무승부 환불 (${bet.amount}포인트)`);
          refunded += 1;
          continue;
        }
        const won = bet.winnerPick === winnerSide;
        if (won) {
          const payout = calculateSideBetPayout(bet.amount, "winner");
          const updatedUser = await UserModel.findOneAndUpdate(
            { id: bet.userId },
            { $inc: { points: payout } },
            { new: true, session },
          ).lean();
          if (updatedUser) {
            await createPointTransaction(session, {
              userId: bet.userId,
              transactionType: "earned",
              amount: payout,
              balance: updatedUser.points,
              description: `승리팀 맞추기 적중 (+${payout}포인트)`,
            });
          }
          await MatchSideBetModel.updateOne(
            { id: bet.id },
            { status: "won", wonAmount: payout },
            { session },
          );
        } else {
          await MatchSideBetModel.updateOne({ id: bet.id }, { status: "lost" }, { session });
        }
        settled += 1;
      } else if (bet.type === "score") {
        const won =
          bet.homeScorePick === homeScore && bet.awayScorePick === awayScore;
        if (won) {
          const payout = calculateSideBetPayout(bet.amount, "score");
          const updatedUser = await UserModel.findOneAndUpdate(
            { id: bet.userId },
            { $inc: { points: payout } },
            { new: true, session },
          ).lean();
          if (updatedUser) {
            await createPointTransaction(session, {
              userId: bet.userId,
              transactionType: "earned",
              amount: payout,
              balance: updatedUser.points,
              description: `최종 스코어 맞추기 적중 (+${payout}포인트)`,
            });
          }
          await MatchSideBetModel.updateOne(
            { id: bet.id },
            { status: "won", wonAmount: payout },
            { session },
          );
        } else {
          await MatchSideBetModel.updateOne({ id: bet.id }, { status: "lost" }, { session });
        }
        settled += 1;
      }
    }

    await session.commitTransaction();
    return { settled, refunded };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function finalizeMatchEnd(matchId: string): Promise<{
  match: Awaited<ReturnType<typeof import("./predictionStorage").endMatch>>;
  sideBetSettled: number;
  sideBetRefunded: number;
}> {
  const match = await MatchModel.findOne({ id: matchId }).lean();
  if (!match) throw new Error("경기를 찾을 수 없습니다.");

  const scoreboard = match.liveScoreboard as
    | { homeScore?: number; awayScore?: number }
    | null
    | undefined;
  const homeScore = scoreboard?.homeScore ?? 0;
  const awayScore = scoreboard?.awayScore ?? 0;

  const { settled, refunded } = await settleMatchSideBets(matchId, homeScore, awayScore);
  const { endMatch } = await import("./predictionStorage");
  const ended = await endMatch(matchId);

  // 운영자·유저가 「경기종료」연출(약 10초)을 본 뒤 자격 만료되도록 지연
  const { revokeOperatorAccessForMatchEnd } = await import("../managerOperatorService");
  const { OPERATOR_MATCH_ENDED_REVOKE_DELAY_MS } = await import("../../shared/operatorMatchStatus");
  setTimeout(() => {
    void (async () => {
      const latest = await MatchModel.findOne({ id: matchId }).select("matchStatus").lean();
      if (latest?.matchStatus !== "completed") {
        console.log(`[MatchEnd] skip operator revoke — match reopened ${matchId}`);
        return;
      }
      await revokeOperatorAccessForMatchEnd(matchId);
    })().catch((err) => {
      console.warn(`[MatchEnd] delayed revoke failed ${matchId}:`, err);
    });
  }, OPERATOR_MATCH_ENDED_REVOKE_DELAY_MS);

  return { match: ended, sideBetSettled: settled, sideBetRefunded: refunded };
}
