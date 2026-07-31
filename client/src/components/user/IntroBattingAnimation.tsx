import introBattingSprite from "@assets/user/intro-batting-sprite.png";
import IntroBrandBall from "@/components/user/IntroBrandBall";

const BATTING_CYCLE_MS = 1400;

/** 인트로 — 빠몽이 타격 + 「빠던나인」 타구 비행 */
export default function IntroBattingAnimation() {
  return (
    <div
      className="intro-batting-stage"
      style={{ ["--intro-batting-duration" as string]: `${BATTING_CYCLE_MS}ms` }}
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
