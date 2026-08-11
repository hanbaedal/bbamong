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
  MatchSideBetModel,
  NoticeReadModel,
  MallWishlistModel,
} from "./UserStorage/db";
import { deleteSession } from "./sessionManager";
import { scheduleDailyKst } from "./utils/kstSchedule";

/** 매일 오전 9시(KST)에 게스트 계정·관련 데이터 하드 삭제 */
export const GUEST_CLEANUP_HOUR_KST = 9;
export const GUEST_CLEANUP_MINUTE_KST = 0;

let cancelSchedule: (() => void) | null = null;

async function hardDeleteGuestUser(userId: string, username: string): Promise<void> {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    await CommentModel.deleteMany({ authorId: userId }, { session });
    await PostModel.deleteMany({ authorId: userId }, { session });
    await AttendanceRecordModel.deleteMany({ userId }, { session });
    await PointTransactionModel.deleteMany({ userId }, { session });
    await InquiryModel.deleteMany({ userId }, { session });
    await EbookPurchaseModel.deleteMany({ userId }, { session });
    await PredictionModel.deleteMany({ userId }, { session });
    await AdViewHistoryModel.deleteMany({ userId }, { session });
    await MatchSideBetModel.deleteMany({ userId }, { session });
    await NoticeReadModel.deleteMany({ userId }, { session });
    await MallWishlistModel.deleteMany({ userId }, { session });
    await UserModel.deleteOne({ id: userId, provider: "guest" }, { session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  try {
    await deleteSession("user", userId);
  } catch {
    /* ignore */
  }

  console.log(`[GuestCleanup] 삭제 완료: ${username} (${userId})`);
}

export async function cleanupGuestUsers(): Promise<{ deleted: number; failed: number }> {
  const guests = await UserModel.find({ provider: "guest" })
    .select("id username")
    .lean();

  if (guests.length === 0) {
    console.log("[GuestCleanup] 삭제할 게스트 없음");
    return { deleted: 0, failed: 0 };
  }

  console.log(`[GuestCleanup] 게스트 ${guests.length}명 삭제 시작`);

  let deleted = 0;
  let failed = 0;

  for (const guest of guests) {
    try {
      await hardDeleteGuestUser(guest.id, guest.username ?? "guest");
      deleted += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `[GuestCleanup] 삭제 실패: ${guest.username} (${guest.id})`,
        error,
      );
    }
  }

  console.log(`[GuestCleanup] 완료 — 삭제 ${deleted}건, 실패 ${failed}건`);
  return { deleted, failed };
}

export function startGuestCleanupBatch(): void {
  if (cancelSchedule) return;

  cancelSchedule = scheduleDailyKst(
    GUEST_CLEANUP_HOUR_KST,
    GUEST_CLEANUP_MINUTE_KST,
    () => {
      void cleanupGuestUsers();
    },
  );

  console.log(
    `[GuestCleanup] Scheduled daily at ${String(GUEST_CLEANUP_HOUR_KST).padStart(2, "0")}:${String(GUEST_CLEANUP_MINUTE_KST).padStart(2, "0")} KST`,
  );
}
