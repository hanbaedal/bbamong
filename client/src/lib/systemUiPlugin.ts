import { Capacitor, registerPlugin } from "@capacitor/core";

interface SystemUiPlugin {
  setImmersive(options: { enabled: boolean }): Promise<void>;
}

const SystemUi = registerPlugin<SystemUiPlugin>("SystemUi", {
  web: () =>
    Promise.resolve({
      setImmersive: async () => {
        /* 웹 — OS 내비게이션 바 없음 */
      },
    }),
});

/** Android 예측게임·운영자 경기 — 시스템 내비·상태바 immersive (숨김) */
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
