import { useEffect } from "react";
import { useLocation } from "wouter";
import { syncOrientationForPath } from "@/lib/gameOrientation";

/** /signup 은 세로, 그 외 게임 앱 경로는 가로 (쇼핑몰 /shop 은 MallApp) */
export default function GameOrientationManager() {
  const [location] = useLocation();

  useEffect(() => {
    void syncOrientationForPath(location.split("?")[0]);
  }, [location]);

  return null;
}
