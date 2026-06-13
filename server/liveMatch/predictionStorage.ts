import { db } from "../UserStorage/db";
import { predictions, users, pointTransactions, matches, roundStatistics } from "@shared/schema";
import type { InsertPrediction, Prediction, Match, RoundStatistics, InsertRoundStatistics } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export async function getUserBalance(userId: string): Promise<number> {
  const [user] = await db
    .select({ points: users.points })
    .from(users)
    .where(eq(users.id, userId));
  return user?.points ?? 0;
}

export async function createPredictionWithPointDeduction(
  predictionData: InsertPrediction
): Promise<Prediction> {
  return await db.transaction(async (tx) => {
    const amount = predictionData.amount ?? 100;
    const roundNumber = predictionData.roundNumber ?? 1;

    const [existingPrediction] = await tx
      .select()
      .from(predictions)
      .where(
        and(
          eq(predictions.userId, predictionData.userId),
          eq(predictions.matchId, predictionData.matchId),
          eq(predictions.roundNumber, roundNumber)
        )
      )
      .for('update');

    if (existingPrediction) {
      if (existingPrediction.status !== 'pending') {
        throw new Error("이미 결과가 확정된 예측은 변경할 수 없습니다.");
      }
      const [updated] = await tx
        .update(predictions)
        .set({ prediction: predictionData.prediction })
        .where(eq(predictions.id, existingPrediction.id))
        .returning();
      return updated;
    }

    const [insertedPrediction] = await tx
      .insert(predictions)
      .values({
        userId: predictionData.userId,
        matchId: predictionData.matchId,
        roundNumber,
        prediction: predictionData.prediction,
        amount,
        status: 'pending',
      })
      .returning();

    // 동시성 제어: 포인트가 충분한 경우에만 차감 (원자적)
    // WHERE 조건으로 포인트 충분 여부 확인 + 차감을 한 번에 처리
    const updateResult = await tx
      .update(users)
      .set({ points: sql`points - ${amount}` })
      .where(
        and(
          eq(users.id, predictionData.userId),
          sql`points >= ${amount}`
        )
      )
      .returning({ points: users.points });

    // 업데이트 실패 = 포인트 부족 또는 사용자 없음
    if (updateResult.length === 0) {
      // 사용자가 존재하는지 확인
      const [user] = await tx
        .select({ points: users.points })
        .from(users)
        .where(eq(users.id, predictionData.userId));

      if (!user) {
        throw new Error("사용자를 찾을 수 없습니다.");
      }
      
      throw new Error("참여기회가 부족합니다.");
    }

    const newBalance = updateResult[0].points;

    // 트랜잭션 기록
    await tx.insert(pointTransactions).values({
      userId: predictionData.userId,
      transactionType: 'spent',
      amount: -amount,
      balance: newBalance,
      description: `경기 예측 참여 (${amount}포인트)`,
    });

    // Drizzle ORM이 이미 camelCase 형식으로 반환
    return insertedPrediction;
  });
}

export async function cancelPredictionAndRefundPoints(
  predictionId: number,
  userId: string
): Promise<void> {
  await db.transaction(async (tx) => {
    const deletedRows = await tx
      .delete(predictions)
      .where(
        and(
          eq(predictions.id, predictionId),
          eq(predictions.userId, userId),
          eq(predictions.status, 'pending')
        )
      )
      .returning({ amount: predictions.amount, matchId: predictions.matchId, roundNumber: predictions.roundNumber });

    if (deletedRows.length === 0) {
      throw new Error("취소할 수 있는 예측이 없습니다.");
    }

    const { amount: predAmount, matchId, roundNumber } = deletedRows[0];
    const amount = predAmount ?? 100;

    const [match] = await tx
      .select({ currentRound: matches.currentRound, predictionEnabled: matches.predictionEnabled })
      .from(matches)
      .where(eq(matches.id, matchId));

    if (!match || match.currentRound !== roundNumber) {
      throw new Error("현재 라운드의 예측만 취소할 수 있습니다.");
    }

    const updateResult = await tx
      .update(users)
      .set({ points: sql`points + ${amount}` })
      .where(eq(users.id, userId))
      .returning({ points: users.points });

    if (updateResult.length === 0) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }

    const newBalance = updateResult[0].points;

    await tx.insert(pointTransactions).values({
      userId,
      transactionType: 'refund',
      amount: amount,
      balance: newBalance,
      description: `예측 취소 환불 (${amount}포인트)`,
    });
  });
}

export async function updatePredictionChoice(
  predictionId: number,
  newPrediction: string
): Promise<Prediction> {
  const [updated] = await db
    .update(predictions)
    .set({ prediction: newPrediction })
    .where(
      and(
        eq(predictions.id, predictionId),
        eq(predictions.status, 'pending')
      )
    )
    .returning();

  if (!updated) {
    throw new Error("예측을 변경할 수 없습니다. 이미 결과가 확정되었습니다.");
  }

  return updated;
}

export async function getPredictionById(id: number): Promise<Prediction | undefined> {
  const [prediction] = await db.select().from(predictions).where(eq(predictions.id, id));
  return prediction;
}

export async function getPredictionsByMatch(matchId: string): Promise<Prediction[]> {
  return db.select().from(predictions).where(eq(predictions.matchId, matchId));
}

export async function getPredictionsByUser(userId: string): Promise<Prediction[]> {
  return db.select().from(predictions).where(eq(predictions.userId, userId));
}

export async function getUserPendingPrediction(userId: string): Promise<(Prediction & { match: Match }) | undefined> {
  const [result] = await db
    .select({
      id: predictions.id,
      userId: predictions.userId,
      matchId: predictions.matchId,
      roundNumber: predictions.roundNumber,
      prediction: predictions.prediction,
      amount: predictions.amount,
      status: predictions.status,
      result: predictions.result,
      wonAmount: predictions.wonAmount,
      donatedAmount: predictions.donatedAmount,
      createdAt: predictions.createdAt,
      match: matches,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .where(and(eq(predictions.userId, userId), eq(predictions.status, 'pending')))
    .orderBy(sql`${predictions.createdAt} DESC`)
    .limit(1);
  
  return result;
}

export async function getUserPredictionForMatch(userId: string, matchId: string): Promise<Prediction | undefined> {
  const [prediction] = await db
    .select()
    .from(predictions)
    .where(and(eq(predictions.userId, userId), eq(predictions.matchId, matchId)));
  return prediction;
}

export async function updatePredictionResult(
  matchId: string,
  result: string
): Promise<void> {
  await db
    .update(predictions)
    .set({
      result,
      status: sql`CASE WHEN prediction = ${result} THEN 'success' ELSE 'fail' END`,
    })
    .where(eq(predictions.matchId, matchId));
}

export async function addUserPoints(userId: string, amount: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`UPDATE users SET points = points + ${amount} WHERE id = ${userId}`);

    const [user] = await tx
      .select({ points: users.points })
      .from(users)
      .where(eq(users.id, userId));

    if (user) {
      await tx.insert(pointTransactions).values({
        userId,
        transactionType: 'earned',
        amount: amount,
        balance: user.points,
        description: `경기 예측 성공 보상 (+${amount}포인트)`,
      });
    }
  });
}

export async function updatePredictionWonAmount(predictionId: number, wonAmount: number): Promise<void> {
  await db
    .update(predictions)
    .set({ wonAmount })
    .where(eq(predictions.id, predictionId));
}

// ===== 라운드 관리 함수 =====

export async function startRound(matchId: string): Promise<Match> {
  return await db.transaction(async (tx) => {
    // 현재 경기 정보 조회
    const [match] = await tx
      .select()
      .from(matches)
      .where(eq(matches.id, matchId));
    
    if (!match) {
      throw new Error("경기를 찾을 수 없습니다.");
    }

    const currentRound = match.currentRound;
    
    // 현재 라운드의 통계 확인 (FOR UPDATE로 row lock — 동시 재시작 방지)
    const [existing] = await tx
      .select()
      .from(roundStatistics)
      .where(
        and(
          eq(roundStatistics.matchId, matchId),
          eq(roundStatistics.roundNumber, currentRound)
        )
      )
      .for('update');

    // 이미 예측이 시작됐고 아직 중지되지 않은 경우: 멱등성 보장 (재호출 무시)
    if (existing && existing.isPredictionStarted && !existing.isPredictionStopped) {
      return match;
    }

    // 결과가 이미 발송된 라운드는 재시작 불가
    if (existing && existing.isResultSent) {
      throw new Error("결과가 이미 발송된 라운드는 재시작할 수 없습니다.");
    }

    // 예측 활성화
    const [updatedMatch] = await tx
      .update(matches)
      .set({ predictionEnabled: true })
      .where(eq(matches.id, matchId))
      .returning();

    // 라운드 통계 업데이트 또는 생성
    if (existing && existing.isPredictionStarted && existing.isPredictionStopped) {
      // 이미 시작→중지된 라운드 재시작: 기존 예측 데이터 초기화 (포인트 환불 포함)
      // DELETE ... RETURNING을 원자적 게이트로 사용 — 동시 요청 중 실제로 삭제한 쪽만 환불 처리
      const deletedPredictions = await tx
        .delete(predictions)
        .where(
          and(
            eq(predictions.matchId, matchId),
            eq(predictions.roundNumber, currentRound),
            eq(predictions.status, 'pending')
          )
        )
        .returning();

      for (const pred of deletedPredictions) {
        const refundAmount = pred.amount ?? 100;
        const [updatedUser] = await tx
          .update(users)
          .set({ points: sql`points + ${refundAmount}` })
          .where(eq(users.id, pred.userId))
          .returning({ points: users.points });

        if (updatedUser) {
          await tx.insert(pointTransactions).values({
            userId: pred.userId,
            transactionType: 'refund',
            amount: refundAmount,
            balance: updatedUser.points,
            description: `예측 재시작으로 인한 자동 환불 (${refundAmount}포인트)`,
          });
        }
      }

      await tx
        .update(roundStatistics)
        .set({
          predictionStartTime: new Date(),
          isPredictionStopped: false,
          totalParticipants: 0,
          totalPoints: 0,
          totalWinners: 0,
        })
        .where(eq(roundStatistics.id, existing.id));
    } else if (existing) {
      await tx
        .update(roundStatistics)
        .set({
          predictionStartTime: new Date(),
          isPredictionStarted: true,
        })
        .where(eq(roundStatistics.id, existing.id));
    } else {
      await tx
        .insert(roundStatistics)
        .values({
          matchId,
          roundNumber: currentRound,
          totalParticipants: 0,
          totalPoints: 0,
          totalWinners: 0,
          predictionStartTime: new Date(),
          isPredictionStarted: true,
          isPredictionStopped: false,
          isResultSent: false,
        });
    }

    return updatedMatch;
  });
}

export async function stopRound(matchId: string): Promise<Match> {
  return await db.transaction(async (tx) => {
    // 현재 경기 정보 조회
    const [match] = await tx
      .select()
      .from(matches)
      .where(eq(matches.id, matchId));
    
    if (!match) {
      throw new Error("경기를 찾을 수 없습니다.");
    }

    const currentRound = match.currentRound;
    
    // 현재 라운드의 통계 확인
    const [existing] = await tx
      .select()
      .from(roundStatistics)
      .where(
        and(
          eq(roundStatistics.matchId, matchId),
          eq(roundStatistics.roundNumber, currentRound)
        )
      );

    // 예측이 아직 시작되지 않은 경우
    if (!existing || !existing.isPredictionStarted) {
      throw new Error(`라운드 ${currentRound}의 예측이 아직 시작되지 않았습니다.`);
    }

    // 이미 예측이 중지된 경우
    if (existing.isPredictionStopped) {
      throw new Error(`라운드 ${currentRound}의 예측이 이미 중지되었습니다.`);
    }

    // 예측 비활성화
    const [updatedMatch] = await tx
      .update(matches)
      .set({ predictionEnabled: false })
      .where(eq(matches.id, matchId))
      .returning();

    // 라운드 통계 업데이트
    await tx
      .update(roundStatistics)
      .set({
        predictionStopTime: new Date(),
        isPredictionStopped: true,
      })
      .where(eq(roundStatistics.id, existing.id));

    return updatedMatch;
  });
}

export async function endMatch(matchId: string): Promise<Match> {
  const [match] = await db
    .update(matches)
    .set({
      matchStatus: 'completed',
      predictionEnabled: false,
      endTime: new Date(),
    })
    .where(eq(matches.id, matchId))
    .returning();
  
  if (!match) {
    throw new Error("경기를 찾을 수 없습니다.");
  }
  
  return match;
}

export async function nextRound(matchId: string, force: boolean = false): Promise<{ match: Match; predictionAutoStopped: boolean }> {
  return await db.transaction(async (tx) => {
    // 현재 경기 정보 조회
    const [match] = await tx
      .select()
      .from(matches)
      .where(eq(matches.id, matchId));
    
    if (!match) {
      throw new Error("경기를 찾을 수 없습니다.");
    }

    const currentRound = match.currentRound;
    
    // 현재 라운드의 통계 확인
    const [existing] = await tx
      .select()
      .from(roundStatistics)
      .where(
        and(
          eq(roundStatistics.matchId, matchId),
          eq(roundStatistics.roundNumber, currentRound)
        )
      );

    let predictionAutoStopped = false;

    // 예측이 아직 중지되지 않은 경우
    if (existing && !existing.isPredictionStopped) {
      if (!force) {
        throw new Error(`라운드 ${currentRound}의 예측이 아직 중지되지 않았습니다. 먼저 예측을 중지해주세요.`);
      }
      // force=true: 예측 자동 중지 후 진행 (공수교대/투수교체 시 언제든 허용)
      console.log(`[nextRound] force=true: 라운드 ${currentRound} 예측 자동 중지 후 진행`);
      await tx
        .update(roundStatistics)
        .set({
          isPredictionStopped: true,
          predictionStopTime: new Date(),
          isResultSent: true,
        })
        .where(eq(roundStatistics.id, existing.id));
      predictionAutoStopped = true;
    }

    // 결과 미전송 체크: force=true면 건너뜀 (공수교대/투수교체 시 제약 없이 허용)
    if (!force && existing && !existing.isResultSent) {
      throw new Error(`라운드 ${currentRound}의 결과가 아직 전송되지 않았습니다. 먼저 결과를 전송해주세요.`);
    }

    // force로 결과 없이 넘어가는 경우: isResultSent=true로 마킹하여 이후 중복 결과 전송 차단
    if (force && existing && !predictionAutoStopped && !existing.isResultSent) {
      console.log(`[nextRound] force=true: 라운드 ${currentRound} 결과 없이 강제 진행, isResultSent=true 마킹`);
      await tx
        .update(roundStatistics)
        .set({ isResultSent: true })
        .where(eq(roundStatistics.id, existing.id));
    }

    // 다음 라운드로 증가
    const nextRoundNumber = currentRound + 1;
    const [updatedMatch] = await tx
      .update(matches)
      .set({
        currentRound: nextRoundNumber,
        predictionEnabled: false,
      })
      .where(eq(matches.id, matchId))
      .returning();

    return { match: updatedMatch, predictionAutoStopped };
  });
}

export async function getMatchInfo(matchId: string): Promise<Match | undefined> {
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId));
  
  return match;
}

export async function getPredictionsByMatchAndRound(
  matchId: string, 
  roundNumber: number
): Promise<Prediction[]> {
  return db
    .select()
    .from(predictions)
    .where(
      and(
        eq(predictions.matchId, matchId),
        eq(predictions.roundNumber, roundNumber)
      )
    );
}

export async function getUserPredictionByMatchRound(
  userId: string,
  matchId: string,
  roundNumber: number
): Promise<Prediction | undefined> {
  const [prediction] = await db
    .select()
    .from(predictions)
    .where(
      and(
        eq(predictions.userId, userId),
        eq(predictions.matchId, matchId),
        eq(predictions.roundNumber, roundNumber)
      )
    );
  return prediction;
}

export async function getLatestResolvedPredictionForMatch(
  userId: string,
  matchId: string
): Promise<Prediction | undefined> {
  const [prediction] = await db
    .select()
    .from(predictions)
    .where(
      and(
        eq(predictions.userId, userId),
        eq(predictions.matchId, matchId),
        sql`${predictions.status} IN ('success', 'fail')`
      )
    )
    .orderBy(sql`${predictions.roundNumber} DESC`)
    .limit(1);
  return prediction;
}

export async function updateRoundPredictionResult(
  matchId: string,
  roundNumber: number,
  result: string
): Promise<Map<string, number>> {
  return await db.transaction(async (tx) => {
    // 0. 라운드 통계 확인 - 이미 결과가 전송되었는지 체크
    const [existingStats] = await tx
      .select()
      .from(roundStatistics)
      .where(
        and(
          eq(roundStatistics.matchId, matchId),
          eq(roundStatistics.roundNumber, roundNumber)
        )
      );

    if (existingStats && existingStats.isResultSent) {
      throw new Error(`라운드 ${roundNumber}의 결과가 이미 전송되었습니다.`);
    }

    if (!existingStats || !existingStats.isPredictionStarted) {
      throw new Error(`라운드 ${roundNumber}의 예측이 아직 시작되지 않았습니다.`);
    }

    if (!existingStats.isPredictionStopped) {
      throw new Error(`라운드 ${roundNumber}의 예측이 아직 중지되지 않았습니다. 먼저 예측을 중지해주세요.`);
    }

    // 1. 해당 라운드의 모든 예측 조회
    const roundPredictions = await tx
      .select()
      .from(predictions)
      .where(
        and(
          eq(predictions.matchId, matchId),
          eq(predictions.roundNumber, roundNumber)
        )
      );

    if (roundPredictions.length === 0) {
      await tx
        .update(roundStatistics)
        .set({ isResultSent: true })
        .where(eq(roundStatistics.id, existingStats.id));
      return new Map<string, number>();
    }

    // 2. 승리자와 패자 필터링
    const winners = roundPredictions.filter(p => p.prediction === result);
    const losers = roundPredictions.filter(p => p.prediction !== result);
    const winnerCount = winners.length;

    // 3. 모든 예측의 결과와 상태 업데이트
    await tx
      .update(predictions)
      .set({
        result,
        status: sql`CASE WHEN prediction = ${result} THEN 'success' ELSE 'fail' END`,
      })
      .where(
        and(
          eq(predictions.matchId, matchId),
          eq(predictions.roundNumber, roundNumber)
        )
      );

    // 4. 승리자가 있는 경우 포인트 지급
    const userWonAmounts = new Map<string, number>();

    if (winnerCount > 0) {
      // 패자들의 베팅금 합계 계산
      const losersPool = losers.reduce((sum, p) => sum + p.amount, 0);
      
      // 10단위 올림 분배
      const rawShare = losersPool / winnerCount;
      const prize = Math.ceil(rawShare / 10) * 10;
      
      // 각 승리자에게 포인트 지급 (각자의 원금 + 상금)
      for (let i = 0; i < winners.length; i++) {
        const winner = winners[i];
        
        // 최종 지급 금액 = 원금 + 상금
        const payout = winner.amount + prize;

        userWonAmounts.set(winner.userId, payout);
        
        // 사용자 포인트 증가
        await tx.execute(
          sql`UPDATE users SET points = points + ${payout} WHERE id = ${winner.userId}`
        );

        // 업데이트된 잔액 조회
        const [updatedUser] = await tx
          .select({ points: users.points })
          .from(users)
          .where(eq(users.id, winner.userId));

        // point_transaction 생성
        if (updatedUser) {
          await tx.insert(pointTransactions).values({
            userId: winner.userId,
            transactionType: 'earned',
            amount: payout,
            balance: updatedUser.points,
            description: `라운드 ${roundNumber} 예측 성공 보상 (상금 ${prize} + 원금 ${winner.amount})`,
          });
        }

        // wonAmount 업데이트
        await tx
          .update(predictions)
          .set({ wonAmount: payout })
          .where(eq(predictions.id, winner.id));
      }
    }

    // 패자들은 wonAmount 0
    for (const loser of losers) {
      if (!userWonAmounts.has(loser.userId)) {
        userWonAmounts.set(loser.userId, 0);
      }
    }

    // 5. 통계 계산 및 업데이트
    const totalPool = roundPredictions.reduce((sum, p) => sum + p.amount, 0);

    await tx
      .update(roundStatistics)
      .set({
        totalParticipants: roundPredictions.length,
        totalPoints: totalPool,
        totalWinners: winnerCount,
        isResultSent: true,
      })
      .where(eq(roundStatistics.id, existingStats.id));

    return userWonAmounts;
  });
}

export async function getRoundStatistics(
  matchId: string,
  roundNumber: number
): Promise<RoundStatistics | undefined> {
  const [stats] = await db
    .select()
    .from(roundStatistics)
    .where(
      and(
        eq(roundStatistics.matchId, matchId),
        eq(roundStatistics.roundNumber, roundNumber)
      )
    );
  
  return stats;
}

export async function getAllRoundStatistics(matchId: string): Promise<RoundStatistics[]> {
  return db
    .select()
    .from(roundStatistics)
    .where(eq(roundStatistics.matchId, matchId))
    .orderBy(roundStatistics.roundNumber);
}

export async function createOrUpdateRoundStatistics(
  matchId: string,
  roundNumber: number,
  totalParticipants: number,
  totalPoints: number,
  totalWinners: number
): Promise<RoundStatistics> {
  const existing = await getRoundStatistics(matchId, roundNumber);
  
  if (existing) {
    const [updated] = await db
      .update(roundStatistics)
      .set({
        totalParticipants,
        totalPoints,
        totalWinners,
      })
      .where(eq(roundStatistics.id, existing.id))
      .returning();
    return updated;
  } else {
    const [created] = await db
      .insert(roundStatistics)
      .values({
        matchId,
        roundNumber,
        totalParticipants,
        totalPoints,
        totalWinners,
      })
      .returning();
    return created;
  }
}

export async function getRoundDetailsWithStatistics(matchId: string) {
  const allRoundStats = await getAllRoundStatistics(matchId);
  
  const roundDetails = await Promise.all(
    allRoundStats.map(async (stats) => {
      const roundPredictions = await getPredictionsByMatchAndRound(matchId, stats.roundNumber);
      
      const result = roundPredictions.length > 0 ? roundPredictions[0].result : null;
      
      let distributedPoints = 0;
      if (stats.totalWinners > 0) {
        const winnersOriginalPoints = roundPredictions
          .filter(p => p.status === 'success')
          .reduce((sum, p) => sum + p.amount, 0);
        distributedPoints = stats.totalPoints - winnersOriginalPoints;
      }
      
      return {
        roundNumber: stats.roundNumber,
        totalParticipants: stats.totalParticipants,
        totalPoints: stats.totalPoints,
        totalWinners: stats.totalWinners,
        result,
        distributedPoints,
      };
    })
  );
  
  return roundDetails;
}

export async function getMatchOverallStatistics(matchId: string) {
  const match = await getMatchInfo(matchId);
  if (!match) {
    throw new Error("경기를 찾을 수 없습니다.");
  }

  const allRoundStats = await getAllRoundStatistics(matchId);
  
  const currentRoundPredictions = await getPredictionsByMatchAndRound(
    matchId,
    match.currentRound
  );

  let totalPredictors = 0;
  let totalPredictionPoints = 0;
  let totalWinners = 0;
  let totalDistributedPoints = 0;

  for (const stats of allRoundStats) {
    totalPredictors += stats.totalParticipants;
    totalPredictionPoints += stats.totalPoints;
    totalWinners += stats.totalWinners;
    
    if (stats.totalWinners > 0) {
      const roundPredictions = await getPredictionsByMatchAndRound(matchId, stats.roundNumber);
      const winnersOriginalPoints = roundPredictions
        .filter(p => p.status === 'success')
        .reduce((sum, p) => sum + p.amount, 0);
      
      const distributedInRound = stats.totalPoints - winnersOriginalPoints;
      totalDistributedPoints += distributedInRound;
    }
  }

  const currentRoundParticipants = currentRoundPredictions.length;
  const currentRoundPoints = currentRoundPredictions.reduce((sum, p) => sum + p.amount, 0);

  return {
    totalPredictors: totalPredictors + currentRoundParticipants,
    totalPredictionPoints: totalPredictionPoints + currentRoundPoints,
    currentRound: match.currentRound,
    totalWinners,
    totalDistributedPoints,
    currentRoundParticipants,
    currentRoundPoints,
    predictionEnabled: match.predictionEnabled,
  };
}

export async function getVictoryRankings(page: number = 1, limit: number = 8) {
  const MAX_RANK = 100; // 상위 100명만 표시
  const offset = (page - 1) * limit;

  // total 계산 시 100명으로 제한
  const totalResult = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${predictions.userId})` })
    .from(predictions)
    .where(eq(predictions.status, 'success'));

  const total = Math.min(totalResult[0]?.count || 0, MAX_RANK);
  const totalPages = Math.ceil(MAX_RANK / limit);

  // offset이 최대 랭킹을 넘어가면 빈 배열 반환
  if (offset >= MAX_RANK) {
    return {
      data: [],
      total,
      page,
      limit,
      totalPages,
    };
  }

  const rankings = await db
    .select({
      userId: predictions.userId,
      username: users.username,
      name: users.name,
      victoryCount: sql<number>`COUNT(*)`,
    })
    .from(predictions)
    .innerJoin(users, eq(predictions.userId, users.id))
    .where(eq(predictions.status, 'success'))
    .groupBy(predictions.userId, users.username, users.name)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(limit)
    .offset(offset);

  return {
    data: rankings,
    total,
    page,
    limit,
    totalPages,
  };
}
