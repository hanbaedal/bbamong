import { useEffect, useRef, useState } from "react";
import GameStadiumBackground from "@/components/game/GameStadiumBackground";
import IntroBattingAnimation from "@/components/user/IntroBattingAnimation";
import IntroBrandBall from "@/components/user/IntroBrandBall";
import IntroSkyBackground from "@/components/user/IntroSkyBackground";
import { INTRO_TAGLINE_TTS, speakIntroTagline, stopIntroSpeech } from "@/lib/introSpeech";

const INTRO_JINGLE_SRC = "/audio/intro-jingle.mp3";

export const INTRO_PHASE_STADIUM_MS = 4200;
export const INTRO_PHASE_TRANSITION_MS = 1500;
export const INTRO_PHASE_BRAND_HOLD_MS = 2000;
export const INTRO_SPLASH_MS =
  INTRO_PHASE_STADIUM_MS + INTRO_PHASE_TRANSITION_MS + INTRO_PHASE_BRAND_HOLD_MS;

type IntroPhase = "stadium" | "transition" | "brand";

export default function IntroSplash() {
  const [phase, setPhase] = useState<IntroPhase>("stadium");
  const jingleRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const jingle = new Audio(INTRO_JINGLE_SRC);
    jingle.volume = 0.55;
    jingle.preload = "auto";
    jingleRef.current = jingle;

    void jingle.play().catch(() => {
      // WebView 자동재생 차단 시 무음 진행
    });

    const transitionTimer = window.setTimeout(() => {
      setPhase("transition");
    }, INTRO_PHASE_STADIUM_MS);

    const brandTimer = window.setTimeout(() => {
      setPhase("brand");
    }, INTRO_PHASE_STADIUM_MS + INTRO_PHASE_TRANSITION_MS);

    const stopJingleTimer = window.setTimeout(() => {
      jingle.pause();
    }, INTRO_SPLASH_MS);

    return () => {
      window.clearTimeout(transitionTimer);
      window.clearTimeout(brandTimer);
      window.clearTimeout(stopJingleTimer);
      jingle.pause();
      jingle.removeAttribute("src");
      jingle.load();
      jingleRef.current = null;
      stopIntroSpeech();
    };
  }, []);

  useEffect(() => {
    if (phase !== "brand") return;

    const jingle = jingleRef.current;
    if (jingle) {
      jingle.volume = 0.55;
      const fadeSteps = 8;
      let step = 0;
      const fadeTimer = window.setInterval(() => {
        step += 1;
        jingle.volume = Math.max(0, 0.55 * (1 - step / fadeSteps));
        if (step >= fadeSteps) {
          window.clearInterval(fadeTimer);
          jingle.pause();
        }
      }, 60);
    }

    void speakIntroTagline();
  }, [phase]);

  const showStadium = phase === "stadium";
  const showSky = phase === "transition" || phase === "brand";
  const showBatting = phase === "stadium";
  const showBrandBall = phase === "transition" || phase === "brand";

  return (
    <div className="user-intro-splash" data-testid="intro-splash" data-intro-phase={phase}>
      <div
        className={`user-intro-splash-bg user-intro-splash-bg--stadium${showStadium ? " is-visible" : ""}`}
        aria-hidden
      >
        <GameStadiumBackground />
        <div className="user-intro-splash-overlay" />
      </div>

      <div
        className={`user-intro-splash-bg user-intro-splash-bg--sky${showSky ? " is-visible" : ""}`}
        aria-hidden
      >
        <IntroSkyBackground />
      </div>

      <div className="user-intro-splash-inner">
        {showBatting ? <IntroBattingAnimation /> : null}

        {showBrandBall ? (
          <IntroBrandBall
            className={
              phase === "brand"
                ? "intro-brand-ball--hold"
                : "intro-brand-ball--zoom"
            }
          />
        ) : null}

        {phase === "brand" ? (
          <p className="intro-brand-caption" aria-live="polite" data-testid="text-intro-caption">
            {INTRO_TAGLINE_TTS}
          </p>
        ) : null}
      </div>
    </div>
  );
}
