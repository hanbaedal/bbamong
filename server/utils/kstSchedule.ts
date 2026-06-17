/** 다음 KST 시각(hour:minute)까지 남은 밀리초 (최소 1초) */
export function msUntilNextKstTime(hour: number, minute = 0): number {
  const now = Date.now();
  const safeHour = Math.min(23, Math.max(0, hour));
  const safeMinute = Math.min(59, Math.max(0, minute));

  for (let offsetMin = 1; offsetMin <= 24 * 60 + 1; offsetMin += 1) {
    const candidate = new Date(now + offsetMin * 60_000);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(candidate);
    const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    if (h === safeHour && m === safeMinute) {
      return offsetMin * 60_000;
    }
  }

  return 24 * 60 * 60_000;
}

export function scheduleDailyKst(
  hour: number,
  minute: number,
  task: () => void | Promise<void>,
): () => void {
  let timer: NodeJS.Timeout | null = null;

  const scheduleNext = () => {
    const delay = msUntilNextKstTime(hour, minute);
    timer = setTimeout(async () => {
      try {
        await task();
      } catch (error) {
        console.error("[KstSchedule] task failed:", error);
      }
      scheduleNext();
    }, delay);
  };

  scheduleNext();

  return () => {
    if (timer) clearTimeout(timer);
  };
}
