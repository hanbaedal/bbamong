import { useEffect } from "react";
import { useLocation } from "wouter";
import { lockGameLandscape } from "@/lib/gameOrientation";

/** 사용자 앱 — 로그인·회원가입·게임 전부 가로 고정 */
export default function GameOrientationManager() {
  const [location] = useLocation();

  useEffect(() => {
    void lockGameLandscape();
  }, [location]);

  return null;
}
