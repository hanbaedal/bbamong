import { Capacitor } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import type { OrientationLockType } from "@capacitor/screen-orientation";
import { isMallPath } from "./shopRoutes";

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

async function isAlreadyLandscape(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return String(screen.orientation?.type || "").startsWith("landscape");
  }
  try {
    const { type } = await ScreenOrientation.orientation();
    return type.startsWith("landscape");
  } catch {
    return false;
  }
}

/**
 * 로그인 · 홈 · 게임 — 가로 고정
 * unlock 하지 않음 (unlock→lock 시 세로↔가로 깜빡임 발생)
 */
export async function lockGameLandscape(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    if (await nativeLock("landscape")) return;
    if (await nativeLock("landscape-primary")) return;
    return;
  }

  if (await webLock("landscape")) return;
  await webLock("landscape-primary");
}

/** 이미 가로면 skip — 불필요한 재lock으로 깜빡임 방지 */
export async function ensureGameLandscape(): Promise<void> {
  if (await isAlreadyLandscape()) return;
  await lockGameLandscape();
}

/** 빠몽이 쇼핑센터(쇼핑몰) — 세로 고정 */
export async function lockMallPortrait(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
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
