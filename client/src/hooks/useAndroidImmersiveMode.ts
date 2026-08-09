import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { setGameImmersiveMode } from "@/lib/systemUiPlugin";

/**
 * Android 시스템 내비·상태바 immersive 숨김.
 * /home, /prediction, 홈 하위(공지·문의·게시판) 등에서 사용.
 */
export function useAndroidImmersiveMode(): void {
  useEffect(() => {
    void setGameImmersiveMode(true);

    let resumeHandle: { remove: () => void } | null = null;
    if (Capacitor.isNativePlatform()) {
      void App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          void setGameImmersiveMode(true);
        }
      }).then((handle) => {
        resumeHandle = handle;
      });
    }

    return () => {
      resumeHandle?.remove();
      void setGameImmersiveMode(false);
    };
  }, []);
}
