/**
 * AdMob 강제 닫기 규칙 — Java ForegroundActivityTracker와 동일해야 한다.
 * 실행: npx tsx scripts/test-google-ads-activity.ts
 */
import { isGoogleAdsActivityName } from "../shared/googleAdsActivity";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(
  isGoogleAdsActivityName("com.google.android.gms.ads.AdActivity"),
  "standard AdMob AdActivity must close",
);
assert(
  isGoogleAdsActivityName("com.google.android.gms.ads.internal.overlay.AdOverlay"),
  "ads.internal overlay must close",
);
assert(
  isGoogleAdsActivityName("com.google.android.gms.ads.OutOfContextTestingActivity"),
  "gms.ads prefix must close",
);
assert(
  !isGoogleAdsActivityName("com.ppamong.app.MainActivity"),
  "MainActivity must never close",
);
assert(
  !isGoogleAdsActivityName("com.ppamong.manager.MainActivity"),
  "manager MainActivity must never close",
);
assert(!isGoogleAdsActivityName(""), "empty name is not ads");
assert(!isGoogleAdsActivityName(null), "null is not ads");
assert(
  !isGoogleAdsActivityName("androidx.browser.customtabs.CustomTabsActivity"),
  "Chrome custom tab is not an ad to force-close",
);

console.log("OK: google ads activity name matching");
process.exit(0);
