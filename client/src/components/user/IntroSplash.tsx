import { useEffect, useRef, useState } from "react";
import IntroBattingAnimation from "@/components/user/IntroBattingAnimation";
import { INTRO_BATTING_MS, INTRO_FADE_MS, INTRO_SPLASH_MS } from "@shared/introBatting";
import { INTRO_TAGLINE_AUDIO_SRC } from "@/lib/introSpeech";

export { INTRO_SPLASH_MS, INTRO_BATTING_MS, INTRO_FADE_MS };

type IntroSplashProps = {
  onDone?: () => void;
  /** -1=구장 타석만, 0–13=14장 컷 고정. 있으면 자동 종료하지 않는다 */
  frameIndex?: number;
};

/** 접속 인트로 — 구장 타석에서 14장 타격 + 멘트 음성 */
export default function IntroSplash({ onDone, frameIndex }: IntroSplashProps) {
  const [fading, setFading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const frozen = typeof frameIndex === "number";

  useEffect(() => {
    if (frozen) return;

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

    let volumeFade: number | undefined;
    const fadeTimer = window.setTimeout(() => {
      setFading(true);
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
      document.removeEventListener("pointerdown", onTap, true);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    };
  }, [frozen]);

  return (
    <div
      className={`user-intro-splash${fading ? " is-fading" : ""}`}
      data-testid="intro-splash"
      data-intro-phase={fading ? "fade" : "batting"}
    >
      <div className="user-intro-splash-inner">
        <IntroBattingAnimation frameIndex={frameIndex} />
      </div>
    </div>
  );
}
