import { MatchModel } from "./UserStorage/db";
import { getKstDateString } from "./utils/dateUtils";
import { revokeOperatorAccessForMatchEnd } from "./managerOperatorService";

const BATCH_INTERVAL_MS = 60 * 60 * 1000;

let batchIntervalId: NodeJS.Timeout | null = null;

async function closeExpiredMatches(): Promise<void> {
  try {
    const kstToday = getKstDateString();
    const now = new Date();

    const expiredMatches = await MatchModel.find({
      matchStatus: { $in: ["scheduled", "ongoing"] },
      $or: [{ matchDate: { $lt: kstToday } }, { matchDate: null, endTime: { $lt: now } }],
    })
      .select("id")
      .lean();

    for (const match of expiredMatches) {
      await revokeOperatorAccessForMatchEnd(match.id);
    }

    const result = await MatchModel.updateMany(
      {
        matchStatus: { $in: ["scheduled", "ongoing"] },
        $or: [{ matchDate: { $lt: kstToday } }, { matchDate: null, endTime: { $lt: now } }],
      },
      { matchStatus: "completed" },
    );

    if (result.modifiedCount > 0) {
      console.log(`[MatchAutoClose] ${result.modifiedCount}개 만료 경기 자동 종료 처리`);
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
