/**
 * Android AdMob 전체화면 Activity 판별 — Java ForegroundActivityTracker와 규칙을 맞춘다.
 * MainActivity / 게임 WebView는 절대 닫지 않는다.
 */
export function isGoogleAdsActivityName(name: string | null | undefined): boolean {
  if (!name) return false;
  if (name.includes("MainActivity")) return false;
  return (
    name.startsWith("com.google.android.gms.ads") ||
    name.includes("AdActivity") ||
    name.includes("ads.internal")
  );
}
