import { useEffect } from "react";
import { useLocation } from "wouter";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { lockGameLandscape, syncOrientationForPath } from "@/lib/gameOrientation";
import { isMallPath } from "@/lib/shopRoutes";

/**
 * 로그인 · 홈 · 게임 — 가로 고정
 * 쇼핑몰(/shop)은 MallApp 에서 세로
 */
export default function GameOrientationManager() {
  const [location] = useLocation();

  useEffect(() => {
    void syncOrientationForPath(location);
  }, [location]);

  /** 앱 복귀·화면 재표시 시 가로 재잠금 (일부 기기에서 풀림 방지) */
  useEffect(() => {
    if (isMallPath(location.split("?")[0] || location)) return;

    const relock = () => {
      void lockGameLandscape();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") relock();
    };
    document.addEventListener("visibilitychange", onVisibility);

    let appHandle: { remove: () => Promise<void> } | undefined;
    if (Capacitor.isNativePlatform()) {
      void App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) relock();
      }).then((handle) => {
        appHandle = handle;
      });
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void appHandle?.remove();
    };
  }, [location]);

  return null;
}
