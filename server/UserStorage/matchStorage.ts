// matchStorage.ts
import { db } from "./db";
import { matches, stadiums } from "@shared/schema";
import { eq, and, or, gte, lte, isNull, ne, sql } from "drizzle-orm";
import type { Match, InsertMatch } from "@shared/schema";
import { getKstDateString } from "../utils/dateUtils";

export class MatchStorage {
  // 오늘 날짜의 종료되지 않은 경기만 조회 (경기장 정보 포함)
  async getTodayActiveMatches(): Promise<Array<Match & { stadiumName: string }>> {
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
        stadiumName: stadiums.name
      })
      .from(matches)
      .leftJoin(stadiums, eq(matches.stadiumId, stadiums.id))
      .where(
        and(
          ne(matches.matchStatus, "completed"),
          ne(matches.matchStatus, "cancelled"),
          // 오늘 날짜 필터
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
      .orderBy(sql`CAST(SUBSTRING(${matches.name} FROM '[0-9]+') AS INTEGER)`);

    return result.map(r => ({ ...r, stadiumName: r.stadiumName || "Unknown Stadium" }));
  }

  // 모든 경기 조회 (경기장 정보 포함)
  async getMatchWithStadium(id?: number): Promise<Array<Match & { stadiumName: string }> | (Match & { stadiumName: string }) | undefined> {
    const query = db.select({
      id: matches.id,
      name: matches.name,
      stadiumId: matches.stadiumId,
      matchDate: matches.matchDate,
      startTime: matches.startTime,
      endTime: matches.endTime,
      matchStatus: matches.matchStatus,
      currentRound: matches.currentRound,
      predictionEnabled: matches.predictionEnabled,
      stadiumName: stadiums.name
    }).from(matches).leftJoin(stadiums, eq(matches.stadiumId, stadiums.id));

    if (id !== undefined) {
      query.where(eq(matches.id, id as any));
      const result = await query;
      if (!result[0]) return undefined;
      return { ...result[0], stadiumName: result[0].stadiumName || "Unknown Stadium" };
    } else {
      const result = await query;
      return result.map(r => ({ ...r, stadiumName: r.stadiumName || "Unknown Stadium" }));
    }
  }

  // 특정 경기 조회 (string ID - UUID)
  async getMatchById(id: string): Promise<(Match & { stadiumName: string }) | undefined> {
    const result = await db.select({
      id: matches.id,
      name: matches.name,
      stadiumId: matches.stadiumId,
      matchDate: matches.matchDate,
      startTime: matches.startTime,
      endTime: matches.endTime,
      matchStatus: matches.matchStatus,
      currentRound: matches.currentRound,
      predictionEnabled: matches.predictionEnabled,
      stadiumName: stadiums.name
    })
    .from(matches)
    .leftJoin(stadiums, eq(matches.stadiumId, stadiums.id))
    .where(eq(matches.id, id));
    
    if (!result[0]) return undefined;
    return { ...result[0], stadiumName: result[0].stadiumName || "Unknown Stadium" };
  }

  // 특정 경기 조회 (deprecated - use getMatchById)
  async getMatch(id: number): Promise<Match | undefined> {
    const result = await db.select().from(matches).where(eq(matches.id, id as any));
    return result[0];
  }

  // 경기장 조회
  async getStadium(id: number) {
    const result = await db.select().from(stadiums).where(eq(stadiums.id, id));
    return result[0];
  }

  // 경기 생성
  async createMatch(match: InsertMatch): Promise<Match> {
    const result = await db.insert(matches).values(match).returning();
    return result[0];
  }

  // 경기 수정
  async updateMatch(id: number, match: Partial<InsertMatch>): Promise<Match | undefined> {
    const result = await db.update(matches).set(match).where(eq(matches.id, id as any)).returning();
    return result[0];
  }

  // 경기 삭제
  async deleteMatch(id: number): Promise<void> {
    await db.delete(matches).where(eq(matches.id, id as any));
  }
}

export const matchStorage = new MatchStorage();
