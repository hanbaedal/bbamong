import { useEffect } from "react";
import { useLocation } from "wouter";
import { Capacitor } from "@capacitor/core";
import { lockGameLandscape } from "@/lib/gameOrientation";

const PORTRAIT_AUTH_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/social-onboarding",
]);

/** 사용자 앱: 게임·홈 등은 가로 고정. 모바일 웹 로그인 계열은 세로 사용 허용 */
export default function GameOrientationManager() {
  const [location] = useLocation();

  useEffect(() => {
    const pathname = location.split("?")[0];
    if (!Capacitor.isNativePlatform() && PORTRAIT_AUTH_PATHS.has(pathname)) {
      return;
    }
    void lockGameLandscape();
  }, [location]);

  return null;
}
