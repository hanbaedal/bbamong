import { useEffect, useState } from "react";
import pyamongRunning1 from "@assets/game/pyamong-running-1.png";
import pyamongRunning2 from "@assets/game/pyamong-running-2.png";
import pyamongRunning3 from "@assets/game/pyamong-running-3.png";

/** 게임 주루와 동일한 보폭 사이클 (우측을 바라보는 포즈) */
const RUN_FRAMES = [pyamongRunning1, pyamongRunning2, pyamongRunning3, pyamongRunning2] as const;
const RUN_FRAME_MS = 120;

export default function LoginMascotRunner() {
  const [frameIdx, setFrameIdx] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setFrameIdx((i) => (i + 1) % RUN_FRAMES.length);
    }, RUN_FRAME_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  return (
    <div className="user-login-mascot-track" aria-hidden>
      <div className="user-login-mascot-runner">
        <img
          src={RUN_FRAMES[frameIdx]}
          alt=""
          className="user-login-mascot-img"
          data-testid="img-login-logo"
        />
      </div>
    </div>
  );
}
