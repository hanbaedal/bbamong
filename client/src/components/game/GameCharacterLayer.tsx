import { useEffect, useMemo, useState } from "react";
import pyamongWaiting from "@assets/game/pyamong-waiting.png";
import pyamongSuccess from "@assets/game/pyamong-success.png";
import pyamongBatToss from "@assets/game/pyamong-bat-toss.png";
import baseballBat from "@assets/game/baseball-bat.png";
import pyamongRunning1 from "@assets/game/pyamong-running-1.png";
import pyamongRunning2 from "@assets/game/pyamong-running-2.png";
import pyamongRunning3 from "@assets/game/pyamong-running-3.png";
import pyamongStandsWaiting from "@assets/game/pyamong-stands-waiting.png";
import pyamongWaveGoodbye from "@assets/game/pyamong-wave-goodbye.png";
import batterWaiting from "@assets/game/batter-waiting.png";
import pyamongBatterReady from "@assets/game/pyamong-batter-ready.png";
import type { GameScreenPhase, PredictionOption } from "./gameTypes";
import type { GameDayOverlayKind, GameDayPhase } from "@/lib/gameDayPhase";
import { LIVE_WAIT_BUBBLE_LINES } from "@/lib/gameDayPhase";
import type { InningHalf } from "@shared/gamePhaseTypes";
import { getRunDurationSec, HOME_RUN_BAT_TOSS_MS } from "./fieldPositions";
import {
  BASE_IMAGE_POINTS,
  getRunFacingRight,
  getRunPathImagePoints,
  HOME_PLATE_IMAGE,
  pathToCssKeyframesPx,
  PITCHER_MOUND_IMAGE,
  STANDS_SEAT_IMAGE,
  stadiumImagePointToPx,
} from "./stadiumFieldCoords";
import { StadiumFieldMarker, useStadiumFieldSize } from "./StadiumFieldContext";
import GameThoughtBubble from "./GameThoughtBubble";
import { PYAMONG_BATTER_WIDTH, PYAMONG_WAIT_RESULT_WIDTH } from "./gameLayoutSizes";
import "./gameAnimations.css";

/** 주루 달리기 스프라이트 프레임 (우측을 바라보는 포즈) */
const PYAMONG_RUN_FRAMES = [pyamongRunning1, pyamongRunning2, pyamongRunning3, pyamongRunning2] as const;
const RUN_FRAME_MS = 120;

interface GameCharacterLayerProps {
  phase: GameScreenPhase;
  gameDayPhase: GameDayPhase;
  gameDayOverlayKind?: GameDayOverlayKind | null;
  selectedPrediction: PredictionOption | null;
  /** 초=원정(빨강) / 말=홈(청색) 틴트 */
  battingHalf?: InningHalf | null;
  onRunComplete?: () => void;
}

function pyamongSpriteClass(
  battingHalf: InningHalf | null | undefined,
  extra = "",
): string {
  const tint =
    battingHalf === "top"
      ? "game-sprite game-sprite-tint-away"
      : battingHalf === "bottom"
        ? "game-sprite game-sprite-tint-home"
        : "game-sprite";
  return extra ? `${tint} ${extra}` : tint;
}

export default function GameCharacterLayer({
  phase,
  gameDayPhase,
  gameDayOverlayKind = null,
  selectedPrediction,
  battingHalf = null,
  onRunComplete,
}: GameCharacterLayerProps) {
  const [runStyleId] = useState(() => `run-${Math.random().toString(36).slice(2, 9)}`);
  const [runFrameIdx, setRunFrameIdx] = useState(0);
  const [runFaceRight, setRunFaceRight] = useState(true);
  const [homeRunTossing, setHomeRunTossing] = useState(false);
  const fieldSize = useStadiumFieldSize();
  const runTarget = selectedPrediction ?? "1루";
  const isHomeRun = runTarget === "홈런";
  const runPath = useMemo(() => getRunPathImagePoints(runTarget), [runTarget]);
  const runDurationSec = useMemo(() => getRunDurationSec(runTarget), [runTarget]);
  const batTossMs = isHomeRun ? HOME_RUN_BAT_TOSS_MS : 0;

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
    if (phase !== "success_running") {
      setHomeRunTossing(false);
      return;
    }

    if (!isHomeRun) {
      setHomeRunTossing(false);
      return;
    }

    setHomeRunTossing(true);
    const t = setTimeout(() => setHomeRunTossing(false), HOME_RUN_BAT_TOSS_MS);
    return () => clearTimeout(t);
  }, [phase, isHomeRun, runTarget]);

  useEffect(() => {
    if (phase !== "success_running") return;
    const ms = batTossMs + runDurationSec * 1000 + 100;
    const t = setTimeout(() => onRunComplete?.(), ms);
    return () => clearTimeout(t);
  }, [phase, runDurationSec, batTossMs, onRunComplete]);

  useEffect(() => {
    if (phase !== "success_running" || homeRunTossing) {
      setRunFrameIdx(0);
      if (phase !== "success_running") setRunFaceRight(true);
      return;
    }

    const startedAt = performance.now();
    const durationMs = Math.max(1, runDurationSec * 1000);
    setRunFaceRight(getRunFacingRight(runPath, 0));

    let rafId = 0;
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      setRunFrameIdx(Math.floor(elapsed / RUN_FRAME_MS) % PYAMONG_RUN_FRAMES.length);
      setRunFaceRight(getRunFacingRight(runPath, Math.min(1, elapsed / durationMs)));
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phase, runDurationSec, runPath, homeRunTossing]);

  return (
    <>
      <style>{keyframesCss}</style>

      {gameDayPhase === "pregame" && !gameDayOverlayKind && (
        <StadiumFieldMarker point={STANDS_SEAT_IMAGE} center={false}>
          <div
            className="pointer-events-none"
            style={{ transform: "translate(-50%, -92%)" }}
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

      {gameDayOverlayKind === "no_match" && (
        <StadiumFieldMarker point={STANDS_SEAT_IMAGE} center={false}>
          <div
            className="pointer-events-none"
            style={{ transform: "translate(-50%, -92%)" }}
          >
            <img
              src={pyamongStandsWaiting}
              alt=""
              className="w-[min(16vw,120px)] h-auto game-sprite animate-pyamong-idle shrink-0 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
              style={{ transformOrigin: "bottom center" }}
              data-testid="char-pyamong-no-match"
            />
          </div>
        </StadiumFieldMarker>
      )}

      {gameDayOverlayKind === "ended" && (
        <StadiumFieldMarker point={STANDS_SEAT_IMAGE} center={false}>
          <div
            className="pointer-events-none"
            style={{ transform: "translate(-50%, -92%)" }}
          >
            <img
              src={pyamongWaveGoodbye}
              alt=""
              className="w-[min(16vw,120px)] h-auto game-sprite animate-pyamong-wave shrink-0 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
              style={{ transformOrigin: "bottom center" }}
              data-testid="char-pyamong-terminal-ended"
            />
          </div>
        </StadiumFieldMarker>
      )}

      {gameDayOverlayKind === "cancelled" && (
        <StadiumFieldMarker point={STANDS_SEAT_IMAGE} center={false}>
          <div
            className="pointer-events-none"
            style={{ transform: "translate(-50%, -92%)" }}
          >
            <img
              src={pyamongWaiting}
              alt=""
              className="w-[min(14vw,105px)] h-auto game-sprite animate-pyamong-idle shrink-0 opacity-90 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
              style={{ transformOrigin: "bottom center" }}
              data-testid="char-pyamong-terminal-cancelled"
            />
          </div>
        </StadiumFieldMarker>
      )}

      {gameDayOverlayKind === "postponed" && (
        <StadiumFieldMarker point={STANDS_SEAT_IMAGE} center={false}>
          <div
            className="pointer-events-none"
            style={{ transform: "translate(-50%, -92%)" }}
          >
            <img
              src={pyamongStandsWaiting}
              alt=""
              className="w-[min(16vw,120px)] h-auto game-sprite animate-pyamong-idle shrink-0 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] hue-rotate-[240deg] saturate-[0.85]"
              style={{ transformOrigin: "bottom center" }}
              data-testid="char-pyamong-terminal-postponed"
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
              className={pyamongSpriteClass(
                battingHalf,
                "h-auto animate-pyamong-idle shrink-0",
              )}
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
          <div
            className="relative flex flex-row items-end gap-2 sm:gap-3 pointer-events-none"
            style={{ transform: "translate(-42%, -100%)" }}
          >
            <div className="relative shrink-0">
              <img
                src={pyamongBatterReady}
                alt=""
                className={pyamongSpriteClass(battingHalf, "h-auto animate-pyamong-idle")}
                style={{ width: PYAMONG_WAIT_RESULT_WIDTH, transformOrigin: "bottom center" }}
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
            {selectedPrediction ? (
              <div
                className="mb-[min(18%,28px)] shrink-0 rounded-xl border-2 border-[#CDFF00] bg-black/75 px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-lg"
                data-testid="wait-result-prediction-badge"
              >
                <p className="text-[10px] sm:text-xs text-white/70 leading-none mb-1">내 예측</p>
                <p className="text-sm sm:text-base font-bold text-[#CDFF00] leading-none whitespace-nowrap">
                  {selectedPrediction}
                </p>
              </div>
            ) : null}
          </div>
        </StadiumFieldMarker>
      )}

      {phase === "success_running" && fieldSize.width > 0 && homeRunTossing && (
        <div
          className="absolute z-[21] pointer-events-none"
          style={{
            left: homePx.left,
            top: homePx.top,
            transform: "translate(-50%, -100%)",
          }}
          data-testid="char-home-run-bat-toss"
        >
          <div className="relative">
            <img
              src={pyamongBatToss}
              alt=""
              className={pyamongSpriteClass(
                battingHalf,
                "w-[min(9vw,72px)] h-auto animate-home-run-toss-pose",
              )}
              data-testid="char-pyamong-bat-toss"
            />
            <img
              src={baseballBat}
              alt=""
              className="absolute left-[55%] top-[8%] w-[min(5.5vw,44px)] h-auto game-sprite animate-home-run-bat-toss"
              data-testid="prop-home-run-bat"
            />
          </div>
        </div>
      )}

      {phase === "success_running" && fieldSize.width > 0 && !homeRunTossing && (
        <div
          className="absolute z-[20] pointer-events-none"
          style={{
            left: homePx.left,
            top: homePx.top,
            animation: `${runStyleId} ${runDurationSec}s ease-in-out forwards`,
          }}
          data-testid="char-batter-running"
        >
          <div
            className="origin-bottom"
            style={{
              transform: `translate(-50%, -100%) scaleX(${runFaceRight ? 1 : -1})`,
            }}
          >
            <img
              src={PYAMONG_RUN_FRAMES[runFrameIdx]}
              alt=""
              className={pyamongSpriteClass(
                battingHalf,
                "w-[min(7vw,64px)] h-auto animate-pyamong-run",
              )}
              data-testid="char-pyamong-running-sprite"
            />
          </div>
        </div>
      )}

      {phase === "success_celebrate" && (
        <StadiumFieldMarker
          point={runTarget === "홈런" ? HOME_PLATE_IMAGE : BASE_IMAGE_POINTS[runTarget]}
          center={runTarget !== "홈런"}
        >
          <div
            style={
              runTarget === "홈런" ? { transform: "translate(-50%, -100%)" } : undefined
            }
          >
            <img
              src={pyamongSuccess}
              alt=""
              className={pyamongSpriteClass(
                battingHalf,
                `w-[min(10vw,78px)] h-auto ${
                  runTarget === "홈런" ? "animate-pyamong-success-home" : "animate-pyamong-success"
                }`,
              )}
              data-testid="char-pyamong-success"
            />
          </div>
        </StadiumFieldMarker>
      )}

      {phase === "fail" && (
        <StadiumFieldMarker point={HOME_PLATE_IMAGE} center={false}>
          <div
            className="relative flex flex-col items-center pointer-events-none"
            style={{ transform: "translate(-50%, -100%)" }}
          >
            <div
              className="mb-2 px-2.5 py-1 rounded-lg bg-black/70 text-white/90 text-[11px] sm:text-xs font-medium animate-sigh-bubble"
              data-testid="speech-out-sigh"
            >
              후우…
            </div>
            <img
              src={pyamongWaiting}
              alt=""
              className={pyamongSpriteClass(
                battingHalf,
                "w-[min(12vw,96px)] h-auto animate-pyamong-sigh opacity-95",
              )}
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
              className={pyamongSpriteClass(
                battingHalf,
                "w-[min(14vw,110px)] h-auto animate-pyamong-pitcher-change shrink-0",
              )}
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
              className={pyamongSpriteClass(
                battingHalf,
                "w-[min(11vw,88px)] h-auto animate-pyamong-idle shrink-0",
              )}
              style={{ transformOrigin: "bottom center" }}
              data-testid="char-pyamong-inning-switch"
            />
          </div>
        </StadiumFieldMarker>
      )}
    </>
  );
}
