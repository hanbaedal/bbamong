import { useEffect } from "react";
import { useLocation } from "wouter";
import { lockMallPortrait } from "@/lib/gameOrientation";

/** 쇼핑몰 — 빠몽이 기념품 세로 고정 */
export default function MallOrientationManager() {
  const [location] = useLocation();

  useEffect(() => {
    void lockMallPortrait();
  }, [location]);

  return null;
}
