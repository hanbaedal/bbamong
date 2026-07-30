import { useEffect } from "react";
import { useLocation } from "wouter";
import { Capacitor } from "@capacitor/core";
import { syncOrientationForPath } from "@/lib/gameOrientation";

/** 네이티브 앱: /prediction 가로, 나머지 세로 자동 전환 */
export default function GameOrientationManager() {
  const [location] = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void syncOrientationForPath(location.split("?")[0]);
  }, [location]);

  return null;
}
