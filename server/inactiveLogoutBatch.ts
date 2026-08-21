import { UserModel } from "./UserStorage/db";
import { deleteSession } from "./sessionManager";
import { wsManager } from "./liveMatch/wsManager";

const INACTIVITY_THRESHOLD_MINUTES = 30;
const BATCH_INTERVAL_MINUTES = 5;

let batchIntervalId: NodeJS.Timeout | null = null;

async function processInactiveUsers(): Promise<void> {
  try {
    const activeUserIds = wsManager.getRecentlyActiveUserIds();
    const thirtyMinutesAgo = new Date(Date.now() - INACTIVITY_THRESHOLD_MINUTES * 60 * 1000);

    const inactiveUsers = await UserModel.find({
      lastActive: { $ne: null, $lt: thirtyMinutesAgo },
      lastLogin: { $ne: null },
      $or: [{ lastLogout: null }, { $expr: { $gt: ["$lastLogin", "$lastLogout"] } }],
    })
      .select("id lastActive")
      .lean();

    if (inactiveUsers.length === 0) {
      return;
    }

    const usersToLogout = inactiveUsers.filter((u) => !activeUserIds.has(u.id));

    if (usersToLogout.length === 0) {
      if (inactiveUsers.length > 0) {
        console.log(
          `[InactiveLogoutBatch] ${inactiveUsers.length} inactive user(s) skipped (WebSocket connected)`,
        );
      }
      return;
    }

    // Mongoose 9 pipeline 배열 updateMany 는 환경/번들에 따라 실패할 수 있어
    // 문서별 $set bulkWrite 로 lastLogout = lastActive 를 기록한다.
    const now = new Date();
    const ops = usersToLogout.map((u) => ({
      updateOne: {
        filter: {
          id: u.id,
          lastActive: { $ne: null, $lt: thirtyMinutesAgo },
          lastLogin: { $ne: null },
          $or: [{ lastLogout: null }, { $expr: { $gt: ["$lastLogin", "$lastLogout"] } }],
        },
        update: {
          $set: { lastLogout: u.lastActive instanceof Date ? u.lastActive : now },
        },
      },
    }));

    const result = await UserModel.bulkWrite(ops, { ordered: false });
    const modified = result.modifiedCount ?? 0;

    // DB 반영 후에만 Redis 세션 삭제 (업데이트 실패 시 강제 로그아웃 방지)
    for (const user of usersToLogout) {
      try {
        await deleteSession("user", user.id);
      } catch (error) {
        console.error(
          `[InactiveLogoutBatch] Failed to delete Redis session for user ${user.id}:`,
          error,
        );
      }
    }

    if (modified > 0) {
      console.log(
        `[InactiveLogoutBatch] Processed ${modified} inactive users (Redis sessions deleted), skipped ${inactiveUsers.length - usersToLogout.length} WS-connected`,
      );
    }
  } catch (error) {
    console.error("[InactiveLogoutBatch] Error processing inactive users:", error);
  }
}

export function startInactiveLogoutBatch(): void {
  if (batchIntervalId) {
    clearInterval(batchIntervalId);
  }

  console.log(
    `[InactiveLogoutBatch] Started - checking every ${BATCH_INTERVAL_MINUTES} minutes for ${INACTIVITY_THRESHOLD_MINUTES} min inactivity`,
  );

  batchIntervalId = setInterval(processInactiveUsers, BATCH_INTERVAL_MINUTES * 60 * 1000);
  processInactiveUsers();
}
