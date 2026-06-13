import {
  AttendanceRecordModel,
  UserModel,
  getNextSequence,
} from "./db";
import type { InsertAttendanceRecord, AttendanceRecord } from "@shared/schema";
import { PointStorage } from "./pointStorage";

export class AttendanceStorage {
  private pointStorage = new PointStorage();

  async createAttendanceRecord(record: InsertAttendanceRecord): Promise<AttendanceRecord> {
    const id = await getNextSequence("attendanceRecord");
    const doc = await AttendanceRecordModel.create({ id, ...record });
    return doc.toObject() as AttendanceRecord;
  }

  async getUserAttendanceRecords(userId: string): Promise<{ attendanceDate: Date }[]> {
    const docs = await AttendanceRecordModel.find({ userId })
      .select("attendanceDate")
      .lean();
    return docs.map((d) => ({ attendanceDate: d.attendanceDate }));
  }

  async getTodayAttendanceStatus(userId: string): Promise<{
    hasCheckedInToday: boolean;
    attendanceRecords: AttendanceRecord[];
  }> {
    const allRecords = await AttendanceRecordModel.find({ userId }).lean();
    const records = allRecords as AttendanceRecord[];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const hasCheckedInToday = records.some((record) => {
      const recordDate = new Date(record.attendanceDate);
      const recordDateOnly = new Date(
        recordDate.getFullYear(),
        recordDate.getMonth(),
        recordDate.getDate(),
      );
      return recordDateOnly.getTime() === today.getTime();
    });

    return { hasCheckedInToday, attendanceRecords: records };
  }

  async checkInAttendance(userId: string): Promise<{ success: boolean; points: number; message: string }> {
    const user = await UserModel.findOne({ id: userId }).lean();
    if (!user) {
      return { success: false, points: 0, message: "사용자를 찾을 수 없습니다." };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (user.lastAttendanceDate) {
      const last = new Date(user.lastAttendanceDate);
      if (
        new Date(last.getFullYear(), last.getMonth(), last.getDate()).getTime() === today.getTime()
      ) {
        return {
          success: false,
          points: user.points,
          message: "이미 오늘 출석하였습니다.",
        };
      }
    }

    const pointAmount = 100;
    const newPoints = user.points + pointAmount;

    await this.pointStorage.addTransaction({
      userId: user.id,
      transactionType: "attendance",
      amount: pointAmount,
      description: "출석 체크 보상",
      balance: 0,
    });

    const attendanceId = await getNextSequence("attendanceRecord");
    await AttendanceRecordModel.create({
      id: attendanceId,
      userId: user.id,
      attendanceDate: now,
    });

    await UserModel.updateOne(
      { id: user.id },
      { lastAttendanceDate: now, points: newPoints },
    );

    return {
      success: true,
      points: newPoints,
      message: `+${pointAmount} 포인트 적립 하였습니다.`,
    };
  }
}

export const attendanceStorage = new AttendanceStorage();
