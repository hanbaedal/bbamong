import { useEffect, useState } from "react";
import {
  INTRO_BATTING_MS,
  INTRO_FRAME_COUNT,
  introFrameIndexAt,
} from "@shared/introBatting";
import frame01 from "@assets/user/intro-batting-frames/01.webp";
import frame02 from "@assets/user/intro-batting-frames/02.webp";
import frame03 from "@assets/user/intro-batting-frames/03.webp";
import frame04 from "@assets/user/intro-batting-frames/04.webp";
import frame05 from "@assets/user/intro-batting-frames/05.webp";
import frame06 from "@assets/user/intro-batting-frames/06.webp";
import frame07 from "@assets/user/intro-batting-frames/07.webp";
import frame08 from "@assets/user/intro-batting-frames/08.webp";
import frame09 from "@assets/user/intro-batting-frames/09.webp";
import frame10 from "@assets/user/intro-batting-frames/10.webp";
import frame11 from "@assets/user/intro-batting-frames/11.webp";
import frame12 from "@assets/user/intro-batting-frames/12.webp";
import frame13 from "@assets/user/intro-batting-frames/13.webp";
import frame14 from "@assets/user/intro-batting-frames/14.webp";

export const INTRO_BATTING_FRAMES = [
  frame01,
  frame02,
  frame03,
  frame04,
  frame05,
  frame06,
  frame07,
  frame08,
  frame09,
  frame10,
  frame11,
  frame12,
  frame13,
  frame14,
] as const;

if (INTRO_BATTING_FRAMES.length !== INTRO_FRAME_COUNT) {
  throw new Error("intro batting frame count mismatch");
}

type IntroBattingAnimationProps = {
  /** 테스트용 고정 프레임(0-based). 없으면 멘트 시간에 맞춰 재생 */
  frameIndex?: number;
};

/** 가로 중앙 빠몽이 — 14장 플립북 (스윙 6 + 타격 후 8) */
export default function IntroBattingAnimation({ frameIndex }: IntroBattingAnimationProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (typeof frameIndex === "number") {
      setIndex(Math.max(0, Math.min(INTRO_FRAME_COUNT - 1, frameIndex)));
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setIndex(INTRO_FRAME_COUNT - 1);
      return;
    }

    const startedAt = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      setIndex(introFrameIndexAt(elapsed));
      if (elapsed < INTRO_BATTING_MS) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frameIndex]);

  return (
    <div className="intro-batting-stage intro-batting-stage--flipbook" aria-hidden>
      <img
        src={INTRO_BATTING_FRAMES[index]}
        alt=""
        className="intro-batting-flip"
        data-testid="intro-batting-animation"
        data-intro-frame={index + 1}
        draggable={false}
      />
    </div>
  );
}
