import { useEffect } from "react";
import { useLocation } from "wouter";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { ensureGameLandscape, syncOrientationForPath } from "@/lib/gameOrientation";
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

  /** 앱 복귀 시에만, 가로가 풀렸을 때 재잠금 (이미 가로면 skip) */
  useEffect(() => {
    if (isMallPath(location.split("?")[0] || location)) return;
    if (!Capacitor.isNativePlatform()) return;

    let appHandle: { remove: () => Promise<void> } | undefined;
    void App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void ensureGameLandscape();
    }).then((handle) => {
      appHandle = handle;
    });

    return () => {
      void appHandle?.remove();
    };
  }, [location]);

  return null;
}
