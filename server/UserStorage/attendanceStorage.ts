// attendanceStorage.ts
import { db } from "./db";
import {
  attendanceRecords,
  users,
  insertPointTransactionSchema,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import type { InsertAttendanceRecord, AttendanceRecord } from "@shared/schema";
import { PointStorage } from "./pointStorage";

export class AttendanceStorage {
  private pointStorage = new PointStorage();

  async createAttendanceRecord(
    record: InsertAttendanceRecord,
  ): Promise<AttendanceRecord> {
    const result = await db
      .insert(attendanceRecords)
      .values(record)
      .returning();
    return result[0];
  }

  async getUserAttendanceRecords(
    userId: string,
  ): Promise<{ attendanceDate: Date }[]> {
    return await db
      .select({ attendanceDate: attendanceRecords.attendanceDate })
      .from(attendanceRecords)
      .where(eq(attendanceRecords.userId, userId));
  }

  // 오늘 출석 상태 확인
  async getTodayAttendanceStatus(userId: string): Promise<{
    hasCheckedInToday: boolean;
    attendanceRecords: AttendanceRecord[];
  }> {
    const allRecords = await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.userId, userId));

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const hasCheckedInToday = allRecords.some((record) => {
      const recordDate = new Date(record.attendanceDate);
      const recordDateOnly = new Date(
        recordDate.getFullYear(),
        recordDate.getMonth(),
        recordDate.getDate(),
      );
      return recordDateOnly.getTime() === today.getTime();
    });

    return {
      hasCheckedInToday,
      attendanceRecords: allRecords,
    };
  }

  // 출석 체크
  async checkInAttendance(userId: string): Promise<{ success: boolean; points: number; message: string }> {
    // 사용자 정보 조회
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    const user = userResult[0];
    if (!user) {
      return {
        success: false,
        points: 0,
        message: "사용자를 찾을 수 없습니다.",
      };
    }
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (user.lastAttendanceDate) {
      const last = new Date(user.lastAttendanceDate);
      if (
        new Date(
          last.getFullYear(),
          last.getMonth(),
          last.getDate(),
        ).getTime() === today.getTime()
      ) {
        return {
          success: false,
          points: user.points,
          message: "이미 오늘 출석하였습니다.",
        };
      }
    }

    const pointAmount = 100; // 출석 포인트
    const newPoints = user.points + pointAmount;

    // PointStorage 내부에서 balance를 자동 계산하도록 호출
    await this.pointStorage.addTransaction({
      userId: user.id,
      transactionType: "attendance",
      amount: pointAmount,
      description: "출석 체크 보상",
      balance: 0, // <-- 더미 값 전달 가능, 내부에서 실제 balance 계산됨
    });

    // 출석 레코드 생성
    await db.insert(attendanceRecords).values({
      userId: user.id,
      attendanceDate: now,
    });

    // users 테이블 업데이트 (lastAttendanceDate와 points)
    await db
      .update(users)
      .set({ 
        lastAttendanceDate: now,
        points: newPoints,
      })
      .where(eq(users.id, user.id));

    return {
      success: true,
      points: newPoints,
      message: `+${pointAmount} 포인트 적립 하였습니다.`,
    };
  }
}

export const attendanceStorage = new AttendanceStorage();
