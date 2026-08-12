import { setNativeKeepScreenOn } from "@/lib/systemUiPlugin";

type WakeLockSentinel = {
  release: () => Promise<void>;
  addEventListener?: (type: "release", listener: () => void) => void;
};

let webWakeLock: WakeLockSentinel | null = null;
let wantKeepAwake = false;

async function requestWebWakeLock(): Promise<void> {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
    };
    if (!nav.wakeLock?.request) return;
    webWakeLock = await nav.wakeLock.request("screen");
    webWakeLock.addEventListener?.("release", () => {
      webWakeLock = null;
    });
  } catch (error) {
    console.warn("[WakeLock] web request failed:", error);
  }
}

async function releaseWebWakeLock(): Promise<void> {
  if (!webWakeLock) return;
  try {
    await webWakeLock.release();
  } catch {
    /* ignore */
  }
  webWakeLock = null;
}

let visibilityListenerBound = false;

function ensureVisibilityRefreshListener(): void {
  if (visibilityListenerBound || typeof document === "undefined") return;
  visibilityListenerBound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !wantKeepAwake) return;
    void refreshGameKeepAwake();
  });
}

/**
 * 예측 게임·운영자 경기 화면 — OS 화면 보호기/절전으로 화면이 꺼지지 않도록 유지.
 * Android: Window FLAG_KEEP_SCREEN_ON
 * Web: Screen Wake Lock API
 */
export async function setGameKeepAwake(enabled: boolean): Promise<void> {
  wantKeepAwake = enabled;
  if (enabled) {
    ensureVisibilityRefreshListener();
    await setNativeKeepScreenOn(true);
    await requestWebWakeLock();
    return;
  }
  await setNativeKeepScreenOn(false);
  await releaseWebWakeLock();
}

/** 앱이 다시 포그라운드로 올 때 Wake Lock 재획득 */
export async function refreshGameKeepAwake(): Promise<void> {
  if (!wantKeepAwake) return;
  await setNativeKeepScreenOn(true);
  if (!webWakeLock) {
    await requestWebWakeLock();
  }
}
