import { DEFAULT_POLL_INTERVAL_MS } from "./constants";
import { pollLinkedMatchesOnce } from "./syncService";

let pollTimer: NodeJS.Timeout | null = null;
let polling = false;

export function startApiSportsPollBatch() {
  if (pollTimer) return;

  pollTimer = setInterval(async () => {
    if (polling) return;
    polling = true;
    try {
      await pollLinkedMatchesOnce();
    } catch (error) {
      console.error("[ApiSportsPoll] batch failed:", error);
    } finally {
      polling = false;
    }
  }, DEFAULT_POLL_INTERVAL_MS);

  void pollLinkedMatchesOnce().catch((error) => {
    console.error("[ApiSportsPoll] initial poll failed:", error);
  });

  console.log(`[ApiSportsPoll] started (${DEFAULT_POLL_INTERVAL_MS}ms)`);
}

export function stopApiSportsPollBatch() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
