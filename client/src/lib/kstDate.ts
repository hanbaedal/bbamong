/** KST 기준 YYYY-MM-DD (서버와 동일 포맷) */
export function getKstDateKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}
