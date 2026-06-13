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
      .select("id")
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

    const logoutIds = usersToLogout.map((u) => u.id);
    const result = await UserModel.updateMany(
      {
        id: { $in: logoutIds },
        lastActive: { $ne: null, $lt: thirtyMinutesAgo },
        lastLogin: { $ne: null },
        $or: [{ lastLogout: null }, { $expr: { $gt: ["$lastLogin", "$lastLogout"] } }],
      },
      [{ $set: { lastLogout: "$lastActive" } }],
    );

    if (result.modifiedCount > 0) {
      console.log(
        `[InactiveLogoutBatch] Processed ${result.modifiedCount} inactive users (Redis sessions deleted), skipped ${inactiveUsers.length - usersToLogout.length} WS-connected`,
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
