import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

const RESUME_DEBOUNCE_MS = 400;

/**
 * 전화·문자·SNS·앱 전환 후 화면이 다시 보일 때 콜백.
 * 웹: visibilitychange(hidden→visible), bfcache pageshow.
 * 네이티브: Capacitor appStateChange(inactive→active)도 함께 듣는다.
 */
export function subscribeForegroundResume(onResume: () => void): () => void {
  if (typeof document === "undefined") return () => undefined;

  let wasBackground = document.visibilityState === "hidden";
  let lastFireAt = 0;
  let cancelled = false;
  let nativeHandle: { remove: () => void } | null = null;

  const fire = () => {
    const now = Date.now();
    if (now - lastFireAt < RESUME_DEBOUNCE_MS) return;
    lastFireAt = now;
    onResume();
  };

  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      wasBackground = true;
      return;
    }
    if (document.visibilityState !== "visible" || !wasBackground) return;
    wasBackground = false;
    fire();
  };

  const onPageShow = (event: PageTransitionEvent) => {
    if (!event.persisted) return;
    wasBackground = false;
    fire();
  };

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pageshow", onPageShow);

  if (Capacitor.isNativePlatform()) {
    void App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) {
        wasBackground = true;
        return;
      }
      if (!wasBackground) return;
      wasBackground = false;
      fire();
    }).then((handle) => {
      if (cancelled) {
        handle.remove();
        return;
      }
      nativeHandle = handle;
    });
  }

  return () => {
    cancelled = true;
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pageshow", onPageShow);
    nativeHandle?.remove();
  };
}
