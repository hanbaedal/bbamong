import { db } from "../UserStorage/db";
import { matches, stadiums, predictions, roundStatistics, type Match, type InsertMatch, adminUsers } from "@shared/schema";
import { eq, desc, gte, lte, and, or, isNull, sql } from "drizzle-orm";
import { getKstDateString } from "../utils/dateUtils";

// 충돌 에러 타입 (409 응답용)
export class MatchConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MatchConflictError';
  }
}

export interface IAdminMatchStorage {
  getAllMatches(): Promise<Match[]>;
  getTodayMatches(): Promise<Array<Match & { stadium: { id: number; name: string } }>>;
  getTodayMatchesByManager(managerId: string): Promise<Array<Match & { stadium: { id: number; name: string } }>>;
  getMatchById(id: string): Promise<(Match & { stadium: { id: number; name: string } }) | undefined>;
  getMatchByIdForManager(id: string, managerId: string): Promise<(Match & { stadium: { id: number; name: string }; predictionStartTime?: Date | null; predictionStopTime?: Date | null }) | undefined>;
  getMatchesByDate(date: Date | string): Promise<Match[]>;
  createMatch(match: InsertMatch): Promise<Match>;
  createMatchBatch(matches: InsertMatch[], targetDate: string): Promise<Match[]>;
  updateMatch(id: string, match: InsertMatch): Promise<Match | undefined>;
  deleteMatch(id: string): Promise<void>;
}

export class AdminMatchStorage implements IAdminMatchStorage {
  async getAllMatches(): Promise<Match[]> {
    return await db.select().from(matches).orderBy(desc(matches.startTime)).execute();
  }

  async getTodayMatches(): Promise<Array<Match & { stadium: { id: number; name: string } }>> {
    // Get today's date in KST timezone (YYYY-MM-DD format)
    const kstToday = getKstDateString();
    
    // Fallback UTC range for legacy records with NULL matchDate
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await db
      .select({
        id: matches.id,
        name: matches.name,
        stadiumId: matches.stadiumId,
        matchDate: matches.matchDate,
        startTime: matches.startTime,
        endTime: matches.endTime,
        matchStatus: matches.matchStatus,
        currentRound: matches.currentRound,
        predictionEnabled: matches.predictionEnabled,
        stadium: {
          id: stadiums.id,
          name: stadiums.name,
        },
      })
      .from(matches)
      .innerJoin(stadiums, eq(matches.stadiumId, stadiums.id))
      .where(
        or(
          // Primary filter: matchDate equals KST today
          eq(matches.matchDate, kstToday),
          // Fallback for NULL matchDate: use startTime range
          and(
            isNull(matches.matchDate),
            gte(matches.startTime, today),
            lte(matches.startTime, tomorrow)
          )
        )
      )
      .orderBy(matches.startTime)
      .execute();

    return result as Array<Match & { stadium: { id: number; name: string } }>;
  }

  async getTodayMatchesByManager(managerId: string): Promise<Array<Match & { stadium: { id: number; name: string } }>> {
    // Get today's date in KST timezone (YYYY-MM-DD format)
    const kstToday = getKstDateString();
    
    // Fallback UTC range for legacy records with NULL matchDate
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 매니저의 할당된 경기 번호 가져오기
    const manager = await db
      .select({ assignedMatchNumber: adminUsers.assignedMatchNumber })
      .from(adminUsers)
      .where(eq(adminUsers.id, managerId))
      .limit(1)
      .execute();

    if (!manager[0]?.assignedMatchNumber) {
      return [];
    }

    const result = await db
      .select({
        id: matches.id,
        name: matches.name,
        stadiumId: matches.stadiumId,
        matchDate: matches.matchDate,
        startTime: matches.startTime,
        endTime: matches.endTime,
        matchStatus: matches.matchStatus,
        currentRound: matches.currentRound,
        predictionEnabled: matches.predictionEnabled,
        stadium: {
          id: stadiums.id,
          name: stadiums.name,
        },
      })
      .from(matches)
      .innerJoin(stadiums, eq(matches.stadiumId, stadiums.id))
      .where(
        and(
          eq(matches.name, manager[0].assignedMatchNumber),
          or(
            // Primary filter: matchDate equals KST today
            eq(matches.matchDate, kstToday),
            // Fallback for NULL matchDate: use startTime range
            and(
              isNull(matches.matchDate),
              gte(matches.startTime, today),
              lte(matches.startTime, tomorrow)
            )
          )
        )
      )
      .orderBy(matches.startTime)
      .execute();

    return result as Array<Match & { stadium: { id: number; name: string } }>;
  }

  async getMatchById(id: string): Promise<(Match & { stadium: { id: number; name: string } }) | undefined> {
    const result = await db
      .select({
        id: matches.id,
        name: matches.name,
        stadiumId: matches.stadiumId,
        startTime: matches.startTime,
        endTime: matches.endTime,
        matchStatus: matches.matchStatus,
        currentRound: matches.currentRound,
        predictionEnabled: matches.predictionEnabled,
        stadium: {
          id: stadiums.id,
          name: stadiums.name,
        },
      })
      .from(matches)
      .innerJoin(stadiums, eq(matches.stadiumId, stadiums.id))
      .where(eq(matches.id, id))
      .execute();

    return result[0] as (Match & { stadium: { id: number; name: string } }) | undefined;
  }

  async getMatchByIdForManager(id: string, managerId: string): Promise<(Match & { stadium: { id: number; name: string }; predictionStartTime?: Date | null; predictionStopTime?: Date | null }) | undefined> {
    // 매니저의 할당된 경기 번호 가져오기
    const manager = await db
      .select({ assignedMatchNumber: adminUsers.assignedMatchNumber })
      .from(adminUsers)
      .where(eq(adminUsers.id, managerId))
      .limit(1)
      .execute();

    if (!manager[0]?.assignedMatchNumber) {
      return undefined;
    }

    const result = await db
      .select({
        id: matches.id,
        name: matches.name,
        stadiumId: matches.stadiumId,
        matchDate: matches.matchDate,
        startTime: matches.startTime,
        endTime: matches.endTime,
        matchStatus: matches.matchStatus,
        currentRound: matches.currentRound,
        predictionEnabled: matches.predictionEnabled,
        predictionStartTime: roundStatistics.predictionStartTime,
        predictionStopTime: roundStatistics.predictionStopTime,
        stadium: {
          id: stadiums.id,
          name: stadiums.name,
        },
      })
      .from(matches)
      .innerJoin(stadiums, eq(matches.stadiumId, stadiums.id))
      .leftJoin(
        roundStatistics,
        and(
          eq(roundStatistics.matchId, matches.id),
          eq(roundStatistics.roundNumber, matches.currentRound)
        )
      )
      .where(
        and(
          eq(matches.id, id),
          eq(matches.name, manager[0].assignedMatchNumber)
        )
      )
      .execute();

    return result[0];
  }

  async getMatchesByDate(date: Date | string): Promise<Match[]> {
    // Convert provided date to KST date string (YYYY-MM-DD)
    const kstDateString = typeof date === 'string' ? date : getKstDateString(date);
    
    // Fallback UTC range for legacy records with NULL matchDate
    // string이면 Date로 변환 (로컬 시간으로 해석)
    const dateObj = typeof date === 'string' ? new Date(date + 'T12:00:00') : date;
    const startOfDay = new Date(dateObj);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await db
      .select()
      .from(matches)
      .where(
        or(
          // Primary filter: matchDate equals provided KST date
          eq(matches.matchDate, kstDateString),
          // Fallback for NULL matchDate: use startTime range
          and(
            isNull(matches.matchDate),
            gte(matches.startTime, startOfDay),
            lte(matches.startTime, endOfDay)
          )
        )
      )
      .execute();

    return result;
  }

  async createMatch(match: InsertMatch): Promise<Match> {
    const [result] = await db.insert(matches).values(match).returning().execute();
    return result;
  }

  async createMatchBatch(matchList: InsertMatch[], targetDate: string): Promise<Match[]> {
    if (matchList.length === 0) {
      return [];
    }

    return await db.transaction(async (tx) => {
      // 1. FOR UPDATE로 기존 경기 조회 (row-level locking)
      const dateObj = new Date(targetDate + 'T12:00:00');
      const startOfDay = new Date(dateObj);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateObj);
      endOfDay.setHours(23, 59, 59, 999);

      const existingMatches = await tx
        .select()
        .from(matches)
        .where(
          or(
            eq(matches.matchDate, targetDate),
            and(
              isNull(matches.matchDate),
              gte(matches.startTime, startOfDay),
              lte(matches.startTime, endOfDay)
            )
          )
        )
        .for('update')
        .execute();

      // 2. ID 기반 매칭 맵 생성
      const existingById = new Map(existingMatches.map(m => [m.id, m]));
      const existingByName = new Map(existingMatches.map(m => [m.name, m]));
      const processedExistingIds = new Set<string>();

      // 3. UPDATE/INSERT/DELETE 분리
      const toUpdate: Array<{ id: string; data: InsertMatch }> = [];
      const toInsert: InsertMatch[] = [];
      const toDelete: Match[] = [];

      // 새 요청 처리: ID가 있으면 UPDATE, 없으면 INSERT만 허용
      for (const newMatch of matchList) {
        // 필수 필드 검증
        if (!newMatch.name || !newMatch.stadiumId || !newMatch.startTime || !newMatch.endTime || !newMatch.matchStatus) {
          throw new MatchConflictError('경기 정보가 불완전합니다. 모든 필수 필드를 입력해주세요.');
        }
        
        if (newMatch.id) {
          // ID가 제공된 경우: ID로 기존 경기 찾기
          const existing = existingById.get(newMatch.id);
          if (existing) {
            // 기존 경기 UPDATE
            toUpdate.push({ id: existing.id, data: newMatch });
            processedExistingIds.add(existing.id);
          } else {
            // ID가 있지만 DB에 없음 -> 에러
            throw new MatchConflictError(`경기 ID ${newMatch.id}를 찾을 수 없습니다. 다른 관리자가 삭제했을 수 있습니다.`);
          }
        } else {
          // ID가 없는 경우: 기존 경기와 충돌 여부 확인
          const existing = existingByName.get(newMatch.name);
          if (existing) {
            // 기존 경기와 이름 충돌 -> 에러 (명확한 의도 필요)
            throw new MatchConflictError(`'${newMatch.name}'는 이미 존재합니다. 수정하려면 기존 경기 데이터를 불러와주세요.`);
          } else {
            // 새 경기 INSERT
            toInsert.push(newMatch);
          }
        }
      }

      // 기존 경기에서 DELETE 판별 (처리되지 않은 경기)
      for (const existing of existingMatches) {
        if (!processedExistingIds.has(existing.id)) {
          toDelete.push(existing);
        }
      }

      // 4. 제출된 경기들의 중복 검증
      const submittedStadiumIds = matchList.map(m => m.stadiumId);
      const uniqueSubmittedStadiums = new Set(submittedStadiumIds);
      
      if (submittedStadiumIds.length !== uniqueSubmittedStadiums.size) {
        throw new MatchConflictError('같은 날짜에 같은 경기구장을 중복 사용할 수 없습니다.');
      }

      // 5. 5경기 제한 검증
      if (matchList.length > 5) {
        throw new MatchConflictError('한 날짜에 최대 5경기까지만 등록할 수 있습니다.');
      }

      // 6. 삭제할 경기들의 predictions 일괄 확인 (preflight)
      if (toDelete.length > 0) {
        const deleteIds = toDelete.map(m => m.id);
        const predictionCounts = await tx
          .select({
            matchId: predictions.matchId,
            count: sql<number>`count(*)::int`
          })
          .from(predictions)
          .where(sql`${predictions.matchId} = ANY(${deleteIds})`)
          .groupBy(predictions.matchId)
          .execute();

        // predictions가 있는 경기가 하나라도 있으면 즉시 중단
        if (predictionCounts.length > 0) {
          const conflictMatches = toDelete
            .filter(m => predictionCounts.some(pc => pc.matchId === m.id))
            .map(m => m.name);
          throw new MatchConflictError(
            `다음 경기들에 예측 데이터가 있어 삭제할 수 없습니다: ${conflictMatches.join(', ')}. 경기를 유지하거나 예측 데이터를 먼저 삭제해주세요.`
          );
        }
      }

      console.log("[DEBUG] Operations:", {
        update: toUpdate.length,
        insert: toInsert.length,
        delete: toDelete.length
      });

      // 7. UPDATE 실행
      for (const { id, data } of toUpdate) {
        const existing = existingById.get(id);
        
        if (existing?.matchStatus === "completed") {
          const timeChanged = 
            existing.startTime.getTime() !== new Date(data.startTime).getTime() ||
            existing.endTime.getTime() !== new Date(data.endTime).getTime();

          if (timeChanged) {
            await tx
              .update(matches)
              .set({
                ...data,
                matchStatus: "scheduled",
                currentRound: 1,
                predictionEnabled: false,
              })
              .where(eq(matches.id, id))
              .execute();
          } else {
            await tx
              .update(matches)
              .set({
                ...data,
                matchStatus: "completed",
                predictionEnabled: false,
              })
              .where(eq(matches.id, id))
              .execute();
          }
        } else {
          await tx
            .update(matches)
            .set(data)
            .where(eq(matches.id, id))
            .execute();
        }
      }

      // 8. DELETE 실행
      for (const match of toDelete) {
        await tx
          .delete(matches)
          .where(eq(matches.id, match.id))
          .execute();
      }

      // 9. INSERT 실행
      let insertedMatches: Match[] = [];
      if (toInsert.length > 0) {
        const insertData = toInsert.map(({ id: _, ...rest }) => rest);
        insertedMatches = await tx
          .insert(matches)
          .values(insertData)
          .returning()
          .execute();
      }

      // 10. 최종 결과 조회 (업데이트된 경기 + 새로 삽입된 경기)
      const finalMatches = await tx
        .select()
        .from(matches)
        .where(
          or(
            eq(matches.matchDate, targetDate),
            and(
              isNull(matches.matchDate),
              gte(matches.startTime, startOfDay),
              lte(matches.startTime, endOfDay)
            )
          )
        )
        .execute();

      return finalMatches;
    });
  }

  async updateMatch(id: string, match: InsertMatch): Promise<Match | undefined> {
    const [result] = await db
      .update(matches)
      .set(match)
      .where(eq(matches.id, id))
      .returning()
      .execute();
    return result;
  }

  async deleteMatch(id: string): Promise<void> {
    await db.delete(matches).where(eq(matches.id, id)).execute();
  }

  async updateMatchPredictionEnabled(id: string, enabled: boolean): Promise<void> {
    // Get current match to know which round
    const [match] = await db.select().from(matches).where(eq(matches.id, id)).execute();
    if (!match) return;

    // Update match prediction enabled status
    await db
      .update(matches)
      .set({ predictionEnabled: enabled })
      .where(eq(matches.id, id))
      .execute();

    // Get or create round statistics
    const [existingStats] = await db
      .select()
      .from(roundStatistics)
      .where(
        and(
          eq(roundStatistics.matchId, id),
          eq(roundStatistics.roundNumber, match.currentRound)
        )
      )
      .execute();

    const now = new Date();

    if (existingStats) {
      // Update existing round statistics
      await db
        .update(roundStatistics)
        .set(
          enabled
            ? { predictionStartTime: now }
            : { predictionStopTime: now }
        )
        .where(eq(roundStatistics.id, existingStats.id))
        .execute();
    } else {
      // Create new round statistics
      await db
        .insert(roundStatistics)
        .values({
          matchId: id,
          roundNumber: match.currentRound,
          totalParticipants: 0,
          totalPoints: 0,
          totalWinners: 0,
          predictionStartTime: enabled ? now : null,
          predictionStopTime: enabled ? null : now,
        })
        .execute();
    }
  }

  async updateRoundResult(matchId: string, roundNumber: number, result: string): Promise<void> {
    // 해당 라운드의 예측들을 업데이트
    await db
      .update(predictions)
      .set({ 
        result,
        status: sql`CASE WHEN prediction = ${result} THEN 'success' ELSE 'fail' END`
      })
      .where(
        and(
          eq(predictions.matchId, matchId),
          eq(predictions.roundNumber, roundNumber)
        )
      )
      .execute();
    
    // 성공한 예측자들에게 포인트 지급
    const successfulPredictions = await db
      .select()
      .from(predictions)
      .where(
        and(
          eq(predictions.matchId, matchId),
          eq(predictions.roundNumber, roundNumber),
          eq(predictions.status, 'success')
        )
      )
      .execute();

    for (const prediction of successfulPredictions) {
      const reward = prediction.amount * 2;
      await db.execute(
        sql`UPDATE users SET points = points + ${reward} WHERE id = ${prediction.userId}`
      );
    }
  }
}

export const adminMatchStorage = new AdminMatchStorage();
