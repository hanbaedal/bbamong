import type { CSSProperties } from "react";
import introBattingSprite from "@assets/user/intro-batting-sprite.png";
import IntroBrandBall from "@/components/user/IntroBrandBall";

const DEFAULT_CYCLE_MS = 1400;

type IntroBattingAnimationProps = {
  cycleMs?: number;
  /** 스윙 반복 횟수. 미지정 시 무한 */
  cycles?: number;
};

/** 인트로 — 빠몽이 타격 + 「빠던나인」 타구 비행 */
export default function IntroBattingAnimation({
  cycleMs = DEFAULT_CYCLE_MS,
  cycles,
}: IntroBattingAnimationProps) {
  const finite = typeof cycles === "number" && cycles > 0;

  return (
    <div
      className={`intro-batting-stage${finite ? " intro-batting-stage--finite" : ""}`}
      style={
        {
          ["--intro-batting-duration"]: `${cycleMs}ms`,
          ["--intro-batting-cycles"]: finite ? String(cycles) : "infinite",
        } as CSSProperties
      }
      aria-hidden
      data-testid="intro-batting-animation"
    >
      <div className="intro-batting-scene">
        <div
          className="intro-batting-sprite"
          style={{ backgroundImage: `url(${introBattingSprite})` }}
        />
        <div className="intro-batting-impact" />
      </div>
      <div className="intro-batting-ball">
        <IntroBrandBall className="intro-brand-ball--fly" labelClassName="intro-brand-ball-label--fly" />
      </div>
    </div>
  );
}
