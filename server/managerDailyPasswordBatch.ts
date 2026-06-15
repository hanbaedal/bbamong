import { ensureOperatorsReady, syncOperatorMatchAssignments } from "./managerOperatorService";

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

let intervalId: NodeJS.Timeout | null = null;

export function startManagerDailyPasswordBatch(): void {
  if (intervalId) return;

  const run = async () => {
    try {
      await ensureOperatorsReady();
      await syncOperatorMatchAssignments();
    } catch (error) {
      console.error("[ManagerOperatorSync] 배치 실패:", error);
    }
  };

  void run();
  intervalId = setInterval(run, CHECK_INTERVAL_MS);
}
