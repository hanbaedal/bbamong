import { useEffect } from "react";
import { useLocation } from "wouter";
import { lockGameLandscape } from "@/lib/gameOrientation";

/** 게임·로그인·회원가입 — 가로 고정 (쇼핑몰 /shop 은 MallApp 에서 세로) */
export default function GameOrientationManager() {
  const [location] = useLocation();

  useEffect(() => {
    void lockGameLandscape();
  }, [location]);

  return null;
}
