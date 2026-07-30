/**
 * Get current date in KST (Asia/Seoul) timezone as YYYY-MM-DD string
 * @param date - Optional date to convert, defaults to current date
 * @returns Date string in YYYY-MM-DD format (KST timezone)
 */
export function getKstDateString(date: Date = new Date()): string {
  // Use Intl.DateTimeFormat to get date in KST timezone
  // 'en-CA' locale gives us YYYY-MM-DD format
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  return formatter.format(date);
}

/** KST 기준 YYYY-MM-DD에 days일 더하기 */
export function addKstDays(dateKey: string, days: number): string {
  const base = new Date(`${dateKey}T12:00:00+09:00`);
  base.setDate(base.getDate() + days);
  return getKstDateString(base);
}

/** KST 기준 당일 00:00:00.000 ~ 23:59:59.999 (UTC Date) */
export function getKstDayRange(date: Date = new Date()): { start: Date; end: Date } {
  const kstDate = getKstDateString(date);
  return {
    start: new Date(`${kstDate}T00:00:00+09:00`),
    end: new Date(`${kstDate}T23:59:59.999+09:00`),
  };
}
