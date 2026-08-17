import { useEffect, useRef, useState } from "react";
import IntroBattingAnimation from "@/components/user/IntroBattingAnimation";

const INTRO_JINGLE_SRC = "/audio/intro-jingle.mp3";

export const INTRO_BATTING_CYCLE_MS = 1400;
export const INTRO_BATTING_CYCLES = 2;
export const INTRO_FADE_MS = 400;
export const INTRO_SPLASH_MS =
  INTRO_BATTING_CYCLE_MS * INTRO_BATTING_CYCLES + INTRO_FADE_MS;

/** 흰 바탕 · 가로 중앙 타격 · 동일 징글 */
export default function IntroSplash() {
  const [fading, setFading] = useState(false);
  const jingleRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const jingle = new Audio(INTRO_JINGLE_SRC);
    jingle.volume = 0.55;
    jingle.preload = "auto";
    jingleRef.current = jingle;

    const tryPlay = () => {
      void jingle.play().catch(() => {
        // WebView 자동재생 차단 시 첫 탭에서 재생
      });
    };
    tryPlay();
    const onTap = () => {
      document.removeEventListener("pointerdown", onTap, true);
      tryPlay();
    };
    document.addEventListener("pointerdown", onTap, { capture: true, once: true, passive: true });

    let volumeFade: number | undefined;
    const fadeAt = INTRO_BATTING_CYCLE_MS * INTRO_BATTING_CYCLES;
    const fadeTimer = window.setTimeout(() => {
      setFading(true);

      const fadeSteps = 8;
      let step = 0;
      volumeFade = window.setInterval(() => {
        step += 1;
        jingle.volume = Math.max(0, 0.55 * (1 - step / fadeSteps));
        if (step >= fadeSteps) {
          if (volumeFade !== undefined) window.clearInterval(volumeFade);
          jingle.pause();
        }
      }, Math.max(30, Math.floor(INTRO_FADE_MS / fadeSteps)));
    }, fadeAt);

    const stopTimer = window.setTimeout(() => {
      jingle.pause();
    }, INTRO_SPLASH_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(stopTimer);
      if (volumeFade !== undefined) window.clearInterval(volumeFade);
      document.removeEventListener("pointerdown", onTap, true);
      jingle.pause();
      jingle.removeAttribute("src");
      jingle.load();
      jingleRef.current = null;
    };
  }, []);

  return (
    <div
      className={`user-intro-splash${fading ? " is-fading" : ""}`}
      data-testid="intro-splash"
      data-intro-phase={fading ? "fade" : "batting"}
    >
      <div className="user-intro-splash-inner">
        <IntroBattingAnimation
          cycleMs={INTRO_BATTING_CYCLE_MS}
          cycles={INTRO_BATTING_CYCLES}
        />
      </div>
    </div>
  );
}
