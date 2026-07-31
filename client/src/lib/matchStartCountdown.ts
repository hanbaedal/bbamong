/** 경기 시작 시각까지 남은 ms (0 미만이면 0) */
export function msUntilMatchStart(
  startTime?: string | Date | null,
  nowMs = Date.now(),
): number | null {
  if (!startTime) return null;
  const startMs = new Date(startTime).getTime();
  if (!Number.isFinite(startMs)) return null;
  return Math.max(0, startMs - nowMs);
}

/** HH:MM:SS (1시간 미만이어도 MM:SS 대신 항상 시:분:초 3단) */
export function formatCountdownMs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

/** KST "18:30" */
export function formatStartTimeKst(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}
