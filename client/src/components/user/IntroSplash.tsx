import { useEffect, useRef, useState } from "react";
import IntroBattingAnimation from "@/components/user/IntroBattingAnimation";
import {
  INTRO_BATTING_MS,
  INTRO_FADE_MS,
  INTRO_SPLASH_MS,
  INTRO_TAGLINE_TEXT,
  introCaptionAt,
} from "@shared/introBatting";
import { INTRO_TAGLINE_AUDIO_SRC } from "@/lib/introSpeech";

export { INTRO_SPLASH_MS, INTRO_BATTING_MS, INTRO_FADE_MS };

type IntroSplashProps = {
  onDone?: () => void;
};

/** 흰 가로 화면 중앙 타격 + 멘트 음성 */
export default function IntroSplash({ onDone }: IntroSplashProps) {
  const [fading, setFading] = useState(false);
  const [caption, setCaption] = useState(introCaptionAt(0));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const audio = new Audio(INTRO_TAGLINE_AUDIO_SRC);
    audio.volume = 1;
    audio.preload = "auto";
    audioRef.current = audio;

    const tryPlay = () => {
      void audio.play().catch(() => {
        // WebView 자동재생 차단 시 첫 탭에서 재생
      });
    };
    tryPlay();
    const onTap = () => {
      document.removeEventListener("pointerdown", onTap, true);
      tryPlay();
    };
    document.addEventListener("pointerdown", onTap, { capture: true, once: true, passive: true });

    const startedAt = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      setCaption(introCaptionAt(now - startedAt));
      if (now - startedAt < INTRO_BATTING_MS) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);

    let volumeFade: number | undefined;
    const fadeTimer = window.setTimeout(() => {
      setFading(true);
      setCaption(INTRO_TAGLINE_TEXT);
      const fadeSteps = 8;
      let step = 0;
      volumeFade = window.setInterval(() => {
        step += 1;
        audio.volume = Math.max(0, 1 - step / fadeSteps);
        if (step >= fadeSteps) {
          if (volumeFade !== undefined) window.clearInterval(volumeFade);
          audio.pause();
        }
      }, Math.max(30, Math.floor(INTRO_FADE_MS / fadeSteps)));
    }, INTRO_BATTING_MS);

    const stopTimer = window.setTimeout(() => {
      audio.pause();
      onDoneRef.current?.();
    }, INTRO_SPLASH_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(stopTimer);
      if (volumeFade !== undefined) window.clearInterval(volumeFade);
      cancelAnimationFrame(raf);
      document.removeEventListener("pointerdown", onTap, true);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    };
  }, []);

  return (
    <div
      className={`user-intro-splash${fading ? " is-fading" : ""}`}
      data-testid="intro-splash"
      data-intro-phase={fading ? "fade" : "batting"}
    >
      <div className="user-intro-splash-inner">
        <IntroBattingAnimation />
        <p className="intro-tagline-caption" data-testid="intro-tagline-caption">
          {caption}
        </p>
      </div>
    </div>
  );
}
