import { useEffect, useMemo, useState } from "react";
import pyamongWaiting from "@assets/game/pyamong-waiting.png";
import pyamongSuccess from "@assets/game/pyamong-success.png";
import batterWaiting from "@assets/game/batter-waiting.png";
import type { GameScreenPhase, PredictionOption } from "./gameTypes";
import { getRunPath, HOME_PLATE, pathToCssKeyframes } from "./fieldPositions";
import "./gameAnimations.css";

interface GameCharacterLayerProps {
  phase: GameScreenPhase;
  selectedPrediction: PredictionOption | null;
  onRunComplete?: () => void;
}

export default function GameCharacterLayer({
  phase,
  selectedPrediction,
  onRunComplete,
}: GameCharacterLayerProps) {
  const [runStyleId] = useState(() => `run-${Math.random().toString(36).slice(2, 9)}`);
  const runTarget = selectedPrediction ?? "1루";
  const runPath = useMemo(() => getRunPath(runTarget), [runTarget]);
  const runDurationSec = Math.max(0.8, runPath.length * 0.55);

  const keyframesCss = useMemo(
    () => pathToCssKeyframes(runStyleId, runPath),
    [runStyleId, runPath],
  );

  useEffect(() => {
    if (phase !== "success_running") return;
    const ms = runDurationSec * 1000 + 100;
    const t = setTimeout(() => onRunComplete?.(), ms);
    return () => clearTimeout(t);
  }, [phase, runDurationSec, onRunComplete]);

  const home = HOME_PLATE;

  return (
    <>
      <style>{keyframesCss}</style>

      {phase === "wait_start" && (
        <div
          className="absolute z-[15] pointer-events-none"
          style={{ left: "44%", top: "58%" }}
        >
          <img
            src={pyamongWaiting}
            alt=""
            className="w-[min(9vw,72px)] h-auto game-sprite animate-pyamong-idle"
            style={{ transform: "translate(-50%, -50%)" }}
            data-testid="char-pyamong-waiting"
          />
          <p
            className="absolute left-1/2 -translate-x-1/2 top-full mt-1 whitespace-nowrap text-white text-[10px] sm:text-xs font-semibold drop-shadow-lg text-center max-w-[70vw]"
            data-testid="text-wait-start"
          >
            다음 타자 예측을 기다리는 중입니다...
          </p>
        </div>
      )}

      {phase === "wait_result" && (
        <div
          className="absolute z-[15] pointer-events-none"
          style={{ left: home.left, top: home.top }}
        >
          <img
            src={batterWaiting}
            alt=""
            className="w-[min(5vw,48px)] h-auto game-sprite"
            style={{ transform: "translate(-50%, -100%)" }}
            data-testid="char-batter-waiting"
          />
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 rounded-xl bg-white/95 text-black text-xs sm:text-sm font-semibold shadow-lg whitespace-nowrap"
            data-testid="speech-wait-result"
          >
            예측결과를 기다립니다
            <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white/95" />
          </div>
        </div>
      )}

      {phase === "success_running" && (
        <div
          className="absolute z-[20] pointer-events-none"
          style={{
            left: home.left,
            top: home.top,
            animation: `${runStyleId} ${runDurationSec}s ease-in-out forwards`,
          }}
          data-testid="char-batter-running"
        >
          <img
            src={batterWaiting}
            alt=""
            className="w-[min(4.5vw,42px)] h-auto game-sprite animate-batter-run"
            style={{ transform: "translate(-50%, -100%)" }}
          />
        </div>
      )}

      {phase === "success_celebrate" && (
        <div
          className="absolute z-[25] pointer-events-none"
          style={{ left: "44%", top: "52%" }}
        >
          <img
            src={pyamongSuccess}
            alt=""
            className="w-[min(10vw,78px)] h-auto game-sprite animate-pyamong-success"
            style={{ transform: "translate(-50%, -50%)" }}
            data-testid="char-pyamong-success"
          />
        </div>
      )}

      {phase === "fail" && (
        <div
          className="absolute z-[15] pointer-events-none"
          style={{ left: home.left, top: home.top }}
        >
          <img
            src={batterWaiting}
            alt=""
            className="w-[min(5vw,48px)] h-auto game-sprite opacity-80"
            style={{ transform: "translate(-50%, -100%)" }}
            data-testid="char-batter-fail"
          />
        </div>
      )}
    </>
  );
}
