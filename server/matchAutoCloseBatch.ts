import { db } from "./UserStorage/db";
import { matches } from "@shared/schema";
import { sql, and, or, isNull, lt, inArray } from "drizzle-orm";
import { getKstDateString } from "./utils/dateUtils";

const BATCH_INTERVAL_MS = 60 * 60 * 1000;

let batchIntervalId: NodeJS.Timeout | null = null;

async function closeExpiredMatches(): Promise<void> {
  try {
    const kstToday = getKstDateString();

    const result = await db
      .update(matches)
      .set({ matchStatus: "completed" })
      .where(
        and(
          inArray(matches.matchStatus, ["scheduled", "ongoing"]),
          or(
            lt(matches.matchDate, kstToday),
            and(
              isNull(matches.matchDate),
              lt(matches.endTime, new Date())
            )
          )
        )
      )
      .returning({ id: matches.id });

    if (result.length > 0) {
      console.log(`[MatchAutoClose] ${result.length}개 만료 경기 자동 종료 처리`);
    }
  } catch (error) {
    console.error("[MatchAutoClose] Error closing expired matches:", error);
  }
}

export function startMatchAutoCloseBatch(): void {
  if (batchIntervalId) {
    clearInterval(batchIntervalId);
  }

  console.log("[MatchAutoClose] Started - checking every 1 hour for expired matches");

  closeExpiredMatches();

  batchIntervalId = setInterval(closeExpiredMatches, BATCH_INTERVAL_MS);
}
