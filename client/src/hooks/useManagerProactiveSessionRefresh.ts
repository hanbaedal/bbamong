import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { refreshAccessToken } from "@/lib/managerQueryClient";

/** access JWT 15분 — 만료 전 선제 갱신 (경기 종료 전까지 세션 유지) */
export const MANAGER_PROACTIVE_REFRESH_MS = 5 * 60_000;

/**
 * 운영자 경기 담당 중 access 토큰 선제 갱신.
 * 네트워크/WS 끊김만으로는 로그아웃하지 않으며, 서버 refresh 401일 때만 세션 종료.
 */
export function useManagerProactiveSessionRefresh(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      void refreshAccessToken().catch(() => {});
    };
    tick();

    const timer = setInterval(tick, MANAGER_PROACTIVE_REFRESH_MS);

    let resumeHandle: { remove: () => void } | null = null;
    if (Capacitor.isNativePlatform()) {
      void App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) tick();
      }).then((handle) => {
        resumeHandle = handle;
      });
    } else {
      const onVisible = () => {
        if (document.visibilityState === "visible") tick();
      };
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        clearInterval(timer);
        document.removeEventListener("visibilitychange", onVisible);
        resumeHandle?.remove();
      };
    }

    return () => {
      clearInterval(timer);
      resumeHandle?.remove();
    };
  }, [enabled]);
}
