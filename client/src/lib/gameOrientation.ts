import { Capacitor } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import type { OrientationLockType } from "@capacitor/screen-orientation";
import { isMallPath } from "./shopRoutes";

const LANDSCAPE_CANDIDATES: OrientationLockType[] = [
  "landscape",
  "landscape-primary",
  "landscape-secondary",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function nativeLock(orientation: OrientationLockType): Promise<boolean> {
  try {
    await ScreenOrientation.lock({ orientation });
    return true;
  } catch (err) {
    console.warn(`[Orientation] native lock ${orientation} failed:`, err);
    return false;
  }
}

async function webLock(orientation: string): Promise<boolean> {
  try {
    const screenOrientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };
    if (typeof screenOrientation?.lock !== "function") return false;
    await screenOrientation.lock(orientation);
    return true;
  } catch {
    return false;
  }
}

/**
 * 로그인 · 홈 · 게임 — 가로 고정
 * APK: unlock 후 재시도 · landscape-primary 폴백 (제조사 편차 완화)
 */
export async function lockGameLandscape(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await ScreenOrientation.unlock();
    } catch {
      /* ignore */
    }
    await sleep(30);

    for (let round = 0; round < 2; round++) {
      if (round > 0) await sleep(120);
      for (const orientation of LANDSCAPE_CANDIDATES) {
        if (await nativeLock(orientation)) return;
        await sleep(40);
      }
    }
    return;
  }

  for (const orientation of ["landscape", "landscape-primary"]) {
    if (await webLock(orientation)) return;
  }
}

/** 빠몽이 기념품(쇼핑몰) — 세로 고정 */
export async function lockMallPortrait(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await ScreenOrientation.unlock();
    } catch {
      /* ignore */
    }
    await sleep(30);
    if (await nativeLock("portrait")) return;
    if (await nativeLock("portrait-primary")) return;
    return;
  }
  await webLock("portrait");
}

/** @deprecated 사용자 앱은 가로 유지 — unlock 하지 않음 */
export async function unlockGameLandscape(): Promise<void> {
  /* intentionally no-op */
}

/** 경로: /shop → 세로, 그 외(로그인·홈·게임) → 가로 */
export async function syncOrientationForPath(pathname: string): Promise<void> {
  const base = pathname.split("?")[0] || pathname;
  if (isMallPath(base)) {
    await lockMallPortrait();
    return;
  }
  await lockGameLandscape();
}
