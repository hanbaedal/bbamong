import { ensureOperatorsReady, getKstDateKey, syncOperatorMatchAssignments } from "./managerOperatorService";

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

let intervalId: NodeJS.Timeout | null = null;
let lastCheckedDate = "";

export function startManagerDailyPasswordBatch(): void {
  if (intervalId) return;

  const run = async () => {
    try {
      const today = getKstDateKey();
      if (today !== lastCheckedDate) {
        await ensureOperatorsReady();
        await syncOperatorMatchAssignments();
        lastCheckedDate = today;
        console.log(`[ManagerDailyPassword] 운영자 일일 비밀번호·경기 할당 동기화 (${today})`);
      }
    } catch (error) {
      console.error("[ManagerDailyPassword] 배치 실패:", error);
    }
  };

  void run();
  intervalId = setInterval(run, CHECK_INTERVAL_MS);
}
