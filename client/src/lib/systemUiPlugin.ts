import { Capacitor, registerPlugin } from "@capacitor/core";

interface SystemUiPlugin {
  setImmersive(options: { enabled: boolean }): Promise<void>;
  setKeepScreenOn(options: { enabled: boolean }): Promise<void>;
  dismissFullscreenAd(): Promise<void>;
  clearPendingAdDismiss(): Promise<void>;
}

const SystemUi = registerPlugin<SystemUiPlugin>("SystemUi", {
  web: () =>
    Promise.resolve({
      setImmersive: async () => {
        /* 웹 — OS 내비게이션 바 없음 */
      },
      setKeepScreenOn: async () => {
        /* 웹 — Screen Wake Lock API는 screenWakeLock.ts에서 처리 */
      },
      dismissFullscreenAd: async () => {
        /* 웹 — 전체화면 AdMob 없음 */
      },
      clearPendingAdDismiss: async () => {
        /* 웹 — pending AdActivity 없음 */
      },
    }),
});

/** Android 홈·공지/문의/게시판·예측게임·운영자 경기 — 시스템 내비·상태바 immersive (숨김) */
export async function setGameImmersiveMode(enabled: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
    return;
  }
  try {
    await SystemUi.setImmersive({ enabled });
  } catch (error) {
    console.warn("[SystemUi] setImmersive failed:", error);
  }
}

/** Android FLAG_KEEP_SCREEN_ON */
export async function setNativeKeepScreenOn(enabled: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return;
  }
  try {
    await SystemUi.setKeepScreenOn({ enabled });
  } catch (error) {
    console.warn("[SystemUi] setKeepScreenOn failed:", error);
  }
}

async function callDismissFullscreenAd(): Promise<void> {
  try {
    await SystemUi.dismissFullscreenAd();
  } catch (error) {
    console.warn("[SystemUi] dismissFullscreenAd failed:", error);
  }
}

/** 새 리워드 세션 전에 이전 강제종료 pending을 푼다. */
export async function clearPendingNativeAdDismiss(): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
    return;
  }
  try {
    await SystemUi.clearPendingAdDismiss();
  } catch (error) {
    console.warn("[SystemUi] clearPendingAdDismiss failed:", error);
  }
}

/** AdMob 리워드/전면(AdActivity)이 떠 있으면 finish 한다. MainActivity BACK은 보내지 않는다. */
export async function dismissNativeFullscreenAd(): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
    return;
  }
  await callDismissFullscreenAd();
}
