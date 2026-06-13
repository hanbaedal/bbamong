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
