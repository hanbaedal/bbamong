import { Capacitor } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";

/** 사용자 앱 전체 가로 고정 (Capacitor 네이티브 + Web API 폴백) */
export async function lockGameLandscape(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await ScreenOrientation.lock({ orientation: "landscape" });
      return;
    } catch (err) {
      console.warn("[Orientation] landscape lock failed:", err);
    }
  }

  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };
    if (typeof orientation?.lock === "function") {
      await orientation.lock("landscape");
    }
  } catch {
    /* 브라우저 정책상 거부될 수 있음 */
  }
}

/** @deprecated 사용자 앱은 가로 고정 — unlock 호출하지 않음 */
export async function unlockGameLandscape(): Promise<void> {
  /* intentionally no-op: 앱 전체 가로 사용 */
}

/** 경로와 무관하게 가로 유지 */
export async function syncOrientationForPath(_pathname: string): Promise<void> {
  await lockGameLandscape();
}
