import { db } from "./UserStorage/db";
import { users } from "@shared/schema";
import { sql, eq, and, lt, isNotNull, or, isNull } from "drizzle-orm";
import { deleteSession } from "./sessionManager";
import { wsManager } from "./liveMatch/wsManager";

const INACTIVITY_THRESHOLD_MINUTES = 30;
const BATCH_INTERVAL_MINUTES = 5;

let batchIntervalId: NodeJS.Timeout | null = null;

async function processInactiveUsers(): Promise<void> {
  try {
    const activeUserIds = wsManager.getRecentlyActiveUserIds();

    const inactiveUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          isNotNull(users.lastActive),
          isNotNull(users.lastLogin),
          lt(users.lastActive, sql`NOW() - INTERVAL '30 minutes'`),
          or(
            isNull(users.lastLogout),
            sql`${users.lastLogin} > ${users.lastLogout}`
          )
        )
      );
    
    if (inactiveUsers.length === 0) {
      return;
    }

    const usersToLogout = inactiveUsers.filter(u => !activeUserIds.has(u.id));

    if (usersToLogout.length === 0) {
      if (inactiveUsers.length > 0) {
        console.log(`[InactiveLogoutBatch] ${inactiveUsers.length} inactive user(s) skipped (WebSocket connected)`);
      }
      return;
    }

    for (const user of usersToLogout) {
      try {
        await deleteSession("user", user.id);
      } catch (error) {
        console.error(`[InactiveLogoutBatch] Failed to delete Redis session for user ${user.id}:`, error);
      }
    }

    const logoutIds = usersToLogout.map(u => u.id);
    const result = await db.execute(sql`
      UPDATE users 
      SET last_logout_at = last_active_at
      WHERE id = ANY(${sql`ARRAY[${sql.join(logoutIds.map(id => sql`${id}`), sql`, `)}]::text[]`})
        AND last_active_at IS NOT NULL
        AND last_login_at IS NOT NULL
        AND last_active_at < NOW() - INTERVAL '30 minutes'
        AND (last_logout_at IS NULL OR last_login_at > last_logout_at)
    `);
    
    const rowCount = (result as any).rowCount || 0;
    if (rowCount > 0) {
      console.log(`[InactiveLogoutBatch] Processed ${rowCount} inactive users (Redis sessions deleted), skipped ${inactiveUsers.length - usersToLogout.length} WS-connected`);
    }
  } catch (error) {
    console.error("[InactiveLogoutBatch] Error processing inactive users:", error);
  }
}

export function startInactiveLogoutBatch(): void {
  // 기존 인터벌이 있으면 정리 (hot-reload 대응)
  if (batchIntervalId) {
    clearInterval(batchIntervalId);
  }
  
  console.log(`[InactiveLogoutBatch] Started - checking every ${BATCH_INTERVAL_MINUTES} minutes for ${INACTIVITY_THRESHOLD_MINUTES} min inactivity`);
  
  batchIntervalId = setInterval(processInactiveUsers, BATCH_INTERVAL_MINUTES * 60 * 1000);
  
  processInactiveUsers();
}
