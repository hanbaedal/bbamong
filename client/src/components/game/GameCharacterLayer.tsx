import { useEffect, useMemo, useState } from "react";
import pyamongWaiting from "@assets/game/pyamong-waiting.png";
import pyamongSuccess from "@assets/game/pyamong-success.png";
import pyamongStandsWaiting from "@assets/game/pyamong-stands-waiting.png";
import batterWaiting from "@assets/game/batter-waiting.png";
import type { GameScreenPhase, PredictionOption } from "./gameTypes";
import type { GameDayPhase } from "@/lib/gameDayPhase";
import { LIVE_WAIT_BUBBLE_LINES } from "@/lib/gameDayPhase";
import { getRunDurationSec } from "./fieldPositions";
import {
  BASE_IMAGE_POINTS,
  getRunPathImagePoints,
  HOME_PLATE_IMAGE,
  pathToCssKeyframesPx,
  PITCHER_MOUND_IMAGE,
  STANDS_SEAT_IMAGE,
  stadiumImagePointToPx,
} from "./stadiumFieldCoords";
import { StadiumFieldMarker, useStadiumFieldSize } from "./StadiumFieldContext";
import GameThoughtBubble from "./GameThoughtBubble";
import { PYAMONG_BATTER_WIDTH } from "./gameLayoutSizes";
import "./gameAnimations.css";

interface GameCharacterLayerProps {
  phase: GameScreenPhase;
  gameDayPhase: GameDayPhase;
  selectedPrediction: PredictionOption | null;
  onRunComplete?: () => void;
}

export default function GameCharacterLayer({
  phase,
  gameDayPhase,
  selectedPrediction,
  onRunComplete,
}: GameCharacterLayerProps) {
  const [runStyleId] = useState(() => `run-${Math.random().toString(36).slice(2, 9)}`);
  const fieldSize = useStadiumFieldSize();
  const runTarget = selectedPrediction ?? "1루";
  const runPath = useMemo(() => getRunPathImagePoints(runTarget), [runTarget]);
  const runDurationSec = useMemo(() => getRunDurationSec(runTarget), [runTarget]);

  const keyframesCss = useMemo(
    () =>
      pathToCssKeyframesPx(runStyleId, runPath, fieldSize.width, fieldSize.height),
    [runStyleId, runPath, fieldSize.width, fieldSize.height],
  );

  const homePx = useMemo(
    () => stadiumImagePointToPx(HOME_PLATE_IMAGE, fieldSize.width, fieldSize.height),
    [fieldSize.width, fieldSize.height],
  );

  useEffect(() => {
    if (phase !== "success_running") return;
    const ms = runDurationSec * 1000 + 100;
    const t = setTimeout(() => onRunComplete?.(), ms);
    return () => clearTimeout(t);
  }, [phase, runDurationSec, onRunComplete]);

  return (
    <>
      <style>{keyframesCss}</style>

      {gameDayPhase === "pregame" && (
        <StadiumFieldMarker point={STANDS_SEAT_IMAGE} center={false}>
          <div
            className="pointer-events-none"
            style={{ transform: "translate(-30%, -88%)" }}
          >
            <img
              src={pyamongStandsWaiting}
              alt=""
              className="w-[min(16vw,120px)] h-auto game-sprite animate-pyamong-idle shrink-0 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
              style={{ transformOrigin: "bottom center" }}
              data-testid="char-pyamong-stands-waiting"
            />
          </div>
        </StadiumFieldMarker>
      )}

      {gameDayPhase === "live" && phase === "wait_start" && (
        <StadiumFieldMarker point={HOME_PLATE_IMAGE} center={false}>
          <div
            className="flex flex-row items-end gap-1 sm:gap-2 pointer-events-none"
            style={{ transform: "translate(-45%, -92%)" }}
          >
            <img
              src={batterWaiting}
              alt=""
              className="h-auto game-sprite animate-pyamong-idle shrink-0"
              style={{ width: PYAMONG_BATTER_WIDTH, transformOrigin: "bottom center" }}
              data-testid="char-pyamong-waiting"
            />
            <GameThoughtBubble
              lines={[...LIVE_WAIT_BUBBLE_LINES]}
              className="mb-[min(5vw,40px)] shrink-0"
              bubbleWidth="min(10vw, 78px)"
              textClassName="text-[min(2.1vw,11px)] sm:text-[min(2.5vw,13px)] leading-[1.12]"
            />
          </div>
        </StadiumFieldMarker>
      )}

      {phase === "wait_result" && (
        <StadiumFieldMarker point={HOME_PLATE_IMAGE} center={false}>
          <div style={{ transform: "translate(-50%, -100%)" }}>
            <img
              src={batterWaiting}
              alt=""
              className="w-[min(5vw,48px)] h-auto game-sprite"
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
        </StadiumFieldMarker>
      )}

      {phase === "success_running" && fieldSize.width > 0 && (
        <div
          className="absolute z-[20] pointer-events-none"
          style={{
            left: homePx.left,
            top: homePx.top,
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
        <StadiumFieldMarker point={BASE_IMAGE_POINTS["2루"]}>
          <img
            src={pyamongSuccess}
            alt=""
            className="w-[min(10vw,78px)] h-auto game-sprite animate-pyamong-success"
            data-testid="char-pyamong-success"
          />
        </StadiumFieldMarker>
      )}

      {phase === "fail" && (
        <StadiumFieldMarker point={HOME_PLATE_IMAGE} center={false}>
          <div style={{ transform: "translate(-50%, -100%)" }}>
            <img
              src={batterWaiting}
              alt=""
              className="w-[min(5vw,48px)] h-auto game-sprite opacity-80"
              data-testid="char-batter-fail"
            />
          </div>
        </StadiumFieldMarker>
      )}

      {phase === "pitcher_change_event" && (
        <StadiumFieldMarker point={PITCHER_MOUND_IMAGE} center={false}>
          <div
            className="flex flex-row items-end gap-1 sm:gap-2 pointer-events-none"
            style={{ transform: "translate(-50%, -100%)" }}
          >
            <img
              src={pyamongWaiting}
              alt=""
              className="w-[min(14vw,110px)] h-auto game-sprite animate-pyamong-pitcher-change shrink-0"
              style={{ transformOrigin: "bottom center" }}
              data-testid="char-pyamong-pitcher-change"
            />
            <GameThoughtBubble text="투수가 교체됩니다!" className="mb-[min(4vw,28px)]" />
          </div>
        </StadiumFieldMarker>
      )}

      {phase === "inning_switch_event" && (
        <StadiumFieldMarker point={PITCHER_MOUND_IMAGE} center={false}>
          <div style={{ transform: "translate(-50%, -100%)" }}>
            <img
              src={pyamongWaiting}
              alt=""
              className="w-[min(11vw,88px)] h-auto game-sprite animate-pyamong-idle shrink-0"
              style={{ transformOrigin: "bottom center" }}
              data-testid="char-pyamong-inning-switch"
            />
          </div>
        </StadiumFieldMarker>
      )}
    </>
  );
}
