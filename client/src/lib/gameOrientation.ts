import { Capacitor } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";

/** 게임 화면 진입 시 가로 고정 (Capacitor 네이티브 + Web API 폴백) */
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

/** 게임 이탈 시 세로 복귀 */
export async function unlockGameLandscape(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await ScreenOrientation.lock({ orientation: "portrait" });
      return;
    } catch (err) {
      console.warn("[Orientation] portrait lock failed:", err);
    }
  }

  try {
    screen.orientation?.unlock?.();
  } catch {
    /* ignore */
  }
}

/** 현재 경로 기준 게임(/prediction)만 가로, 그 외 세로 */
export async function syncOrientationForPath(pathname: string): Promise<void> {
  if (pathname === "/prediction") {
    await lockGameLandscape();
  } else {
    await unlockGameLandscape();
  }
}
