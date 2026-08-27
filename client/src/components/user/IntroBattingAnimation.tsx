import { useEffect, useState, type CSSProperties } from "react";
import {
  INTRO_BATTING_MS,
  INTRO_CROSSFADE_MS,
  INTRO_FRAME_COUNT,
  INTRO_SPRITE_BOX,
  INTRO_STADIUM_ASPECT,
  INTRO_STADIUM_HOLD_MS,
  introFrameIndexAt,
} from "@shared/introBatting";
import introStadium from "@assets/user/intro-stadium-home.jpg";
import introStadiumEmpty from "@assets/user/intro-stadium-empty.jpg";
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
  frame11,
  frame10,
  frame08,
  frame09,
  frame12,
  frame13,
  frame14,
] as const;

if (INTRO_BATTING_FRAMES.length !== INTRO_FRAME_COUNT) {
  throw new Error("intro batting frame count mismatch");
}

type IntroBattingAnimationProps = {
  /** 테스트용 고정. -1=구장 타석만, 0–13=14장 컷. 없으면 멘트 시간에 맞춰 재생 */
  frameIndex?: number;
};

/** 구장 타석에서 시작해 14장 플립북으로 이어진다 */
export default function IntroBattingAnimation({ frameIndex }: IntroBattingAnimationProps) {
  const [index, setIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(0);
  const [overlayOn, setOverlayOn] = useState(false);

  useEffect(() => {
    if (typeof frameIndex === "number") {
      const frozenStadium = frameIndex < 0;
      const next = frozenStadium
        ? 0
        : Math.max(0, Math.min(INTRO_FRAME_COUNT - 1, frameIndex));
      setPrevIndex(next);
      setIndex(next);
      setOverlayOn(!frozenStadium);
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setIndex(INTRO_FRAME_COUNT - 1);
      setPrevIndex(INTRO_FRAME_COUNT - 1);
      setOverlayOn(true);
      return;
    }

    const startedAt = performance.now();
    let raf = 0;
    let last = -1;
    setOverlayOn(false);
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      if (elapsed < INTRO_STADIUM_HOLD_MS) {
        setOverlayOn(false);
      } else {
        const next = introFrameIndexAt(elapsed);
        setOverlayOn(true);
        if (next !== last) {
          setPrevIndex(last < 0 ? next : last);
          setIndex(next);
          last = next;
        }
      }
      if (elapsed < INTRO_BATTING_MS) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frameIndex]);

  const showCrossfade = overlayOn && index !== prevIndex;
  const spriteBoxStyle = {
    left: INTRO_SPRITE_BOX.left,
    top: INTRO_SPRITE_BOX.top,
    width: INTRO_SPRITE_BOX.width,
    height: INTRO_SPRITE_BOX.height,
  } as CSSProperties;

  return (
    <div className="intro-batting-stage intro-batting-stage--flipbook" aria-hidden>
      <div
        className="intro-scene-fit"
        style={
          {
            width: `max(100%, calc(100dvh * ${INTRO_STADIUM_ASPECT}))`,
            height: `max(100%, calc(100dvw / ${INTRO_STADIUM_ASPECT}))`,
          } as CSSProperties
        }
      >
        <img
          src={introStadium}
          alt=""
          className="intro-scene-bg"
          draggable={false}
          decoding="async"
          fetchPriority="high"
          data-testid="intro-stadium-bg"
        />
        <img
          src={introStadiumEmpty}
          alt=""
          className={`intro-scene-bg intro-scene-bg--empty${overlayOn ? " is-active" : ""}`}
          draggable={false}
          decoding="async"
          data-testid="intro-stadium-empty"
        />
        <div
          className={`intro-scene-blocker${overlayOn ? " is-active" : ""}`}
          data-testid="intro-scene-blocker"
        />
        <div
          className={`intro-sprite-slot${overlayOn ? " is-active" : ""}`}
          style={spriteBoxStyle}
        >
          {overlayOn && showCrossfade ? (
            <img
              src={INTRO_BATTING_FRAMES[prevIndex]}
              alt=""
              className="intro-batting-flip intro-batting-flip--under"
              draggable={false}
            />
          ) : null}
          {overlayOn ? (
            <img
              key={index}
              src={INTRO_BATTING_FRAMES[index]}
              alt=""
              className={`intro-batting-flip${showCrossfade ? " intro-batting-flip--over" : ""}`}
              style={
                showCrossfade
                  ? ({ ["--intro-crossfade-ms"]: `${INTRO_CROSSFADE_MS}ms` } as CSSProperties)
                  : undefined
              }
              data-testid="intro-batting-animation"
              data-intro-frame={index + 1}
              draggable={false}
            />
          ) : (
            <span data-testid="intro-stadium-hold" hidden />
          )}
        </div>
      </div>
    </div>
  );
}
