import { Capacitor } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { isMallPath } from "./shopRoutes";

async function lockOrientation(orientation: "landscape" | "portrait"): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await ScreenOrientation.lock({ orientation });
      return;
    } catch (err) {
      console.warn(`[Orientation] ${orientation} lock failed:`, err);
    }
  }

  try {
    const screenOrientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };
    if (typeof screenOrientation?.lock === "function") {
      await screenOrientation.lock(orientation);
    }
  } catch {
    /* 브라우저 정책상 거부될 수 있음 */
  }
}

/** 게임·로그인·회원가입 — 가로 고정 (Capacitor 네이티브 + Web API 폴백) */
export async function lockGameLandscape(): Promise<void> {
  await lockOrientation("landscape");
}

/** 빠몽이 기념품(쇼핑몰) — 세로 고정 */
export async function lockMallPortrait(): Promise<void> {
  await lockOrientation("portrait");
}

/** @deprecated unlock 호출하지 않음 — 앱별 lock으로 전환 */
export async function unlockGameLandscape(): Promise<void> {
  /* intentionally no-op */
}

/** 회원가입 — 세로 고정 */
export async function lockSignupPortrait(): Promise<void> {
  await lockOrientation("portrait");
}

/** 경로에 맞는 화면 방향: /shop → 세로, /signup → 세로, 그 외 → 가로 */
export async function syncOrientationForPath(pathname: string): Promise<void> {
  const base = pathname.split("?")[0];
  if (isMallPath(base)) {
    await lockMallPortrait();
  } else if (base === "/signup") {
    await lockSignupPortrait();
  } else {
    await lockGameLandscape();
  }
}
