import { db } from "./UserStorage/db";
import { users, comments, posts, attendanceRecords, pointTransactions, inquiries, ebookPurchases, predictions, adViewHistory } from "@shared/schema";
import { eq, and, lte } from "drizzle-orm";
import { deleteSession } from "./sessionManager";

const BATCH_INTERVAL_MS = 60 * 60 * 1000;
const RETENTION_DAYS = 730;

let intervalId: NodeJS.Timeout | null = null;

async function cleanupSuspendedUsers() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    const expiredUsers = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(
        and(
          eq(users.isSuspended, 1),
          lte(users.suspendedAt, cutoffDate)
        )
      );

    if (expiredUsers.length === 0) return;

    console.log(`[SuspendedCleanup] ${expiredUsers.length}명의 삭제 대기 회원 영구 삭제 시작`);

    for (const user of expiredUsers) {
      try {
        await db.transaction(async (tx) => {
          await tx.delete(comments).where(eq(comments.authorId, user.id));
          await tx.delete(posts).where(eq(posts.authorId, user.id));
          await tx.delete(attendanceRecords).where(eq(attendanceRecords.userId, user.id));
          await tx.delete(pointTransactions).where(eq(pointTransactions.userId, user.id));
          await tx.delete(inquiries).where(eq(inquiries.userId, user.id));
          await tx.delete(ebookPurchases).where(eq(ebookPurchases.userId, user.id));
          await tx.delete(predictions).where(eq(predictions.userId, user.id));
          await tx.delete(adViewHistory).where(eq(adViewHistory.userId, user.id));
          await tx.delete(users).where(eq(users.id, user.id));
        });

        try {
          await deleteSession("user", user.id);
        } catch {}

        console.log(`[SuspendedCleanup] 영구 삭제 완료: ${user.username} (${user.id})`);
      } catch (error) {
        console.error(`[SuspendedCleanup] 삭제 실패: ${user.username} (${user.id})`, error);
      }
    }

    console.log(`[SuspendedCleanup] 정리 완료`);
  } catch (error) {
    console.error("[SuspendedCleanup] 배치 실행 오류:", error);
  }
}

export function startSuspendedUserCleanupBatch() {
  if (intervalId) return;

  cleanupSuspendedUsers();
  intervalId = setInterval(cleanupSuspendedUsers, BATCH_INTERVAL_MS);
  console.log(`[SuspendedCleanup] Started - checking every 1 hour for users suspended > ${RETENTION_DAYS} days`);
}
