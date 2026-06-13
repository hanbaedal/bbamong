import {
  mongoose,
  UserModel,
  CommentModel,
  PostModel,
  AttendanceRecordModel,
  PointTransactionModel,
  InquiryModel,
  EbookPurchaseModel,
  PredictionModel,
  AdViewHistoryModel,
} from "./UserStorage/db";
import { deleteSession } from "./sessionManager";

const BATCH_INTERVAL_MS = 60 * 60 * 1000;
const RETENTION_DAYS = 730;

let intervalId: NodeJS.Timeout | null = null;

async function cleanupSuspendedUsers() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    const expiredUsers = await UserModel.find({
      isSuspended: 1,
      suspendedAt: { $lte: cutoffDate },
    })
      .select("id username")
      .lean();

    if (expiredUsers.length === 0) return;

    console.log(`[SuspendedCleanup] ${expiredUsers.length}명의 삭제 대기 회원 영구 삭제 시작`);

    for (const user of expiredUsers) {
      try {
        const session = await mongoose.startSession();
        try {
          session.startTransaction();
          await CommentModel.deleteMany({ authorId: user.id }, { session });
          await PostModel.deleteMany({ authorId: user.id }, { session });
          await AttendanceRecordModel.deleteMany({ userId: user.id }, { session });
          await PointTransactionModel.deleteMany({ userId: user.id }, { session });
          await InquiryModel.deleteMany({ userId: user.id }, { session });
          await EbookPurchaseModel.deleteMany({ userId: user.id }, { session });
          await PredictionModel.deleteMany({ userId: user.id }, { session });
          await AdViewHistoryModel.deleteMany({ userId: user.id }, { session });
          await UserModel.deleteOne({ id: user.id }, { session });
          await session.commitTransaction();
        } catch (error) {
          await session.abortTransaction();
          throw error;
        } finally {
          session.endSession();
        }

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
  console.log(
    `[SuspendedCleanup] Started - checking every 1 hour for users suspended > ${RETENTION_DAYS} days`,
  );
}
