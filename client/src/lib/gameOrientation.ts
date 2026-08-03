import { Capacitor } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { isMallPath } from "./shopRoutes";

type AppOrientation = "landscape" | "portrait";

let lastLockedOrientation: AppOrientation | null = null;

async function lockOrientation(orientation: AppOrientation): Promise<void> {
  if (lastLockedOrientation === orientation) {
    return;
  }

  if (Capacitor.isNativePlatform()) {
    try {
      if (lastLockedOrientation !== null && lastLockedOrientation !== orientation) {
        await ScreenOrientation.unlock();
      }
      await ScreenOrientation.lock({ orientation });
      lastLockedOrientation = orientation;
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
      lastLockedOrientation = orientation;
    }
  } catch {
    /* 브라우저 정책상 거부될 수 있음 */
  }
}

export function setSignupPortraitDocumentClass(active: boolean): void {
  document.documentElement.classList.toggle("user-signup-portrait-active", active);
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
