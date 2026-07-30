import { useEffect } from "react";
import { useLocation } from "wouter";
import { lockGameLandscape } from "@/lib/gameOrientation";

/** 사용자 앱: 로그인·홈·게임·콘텐츠 전부 가로 유지 */
export default function GameOrientationManager() {
  const [location] = useLocation();

  useEffect(() => {
    void lockGameLandscape();
  }, [location]);

  return null;
}
