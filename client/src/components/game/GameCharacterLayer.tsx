import { useEffect, useMemo, useState, type ReactNode } from "react";
import pyamongWaiting from "@assets/game/pyamong-waiting.png";
import pyamongSuccess from "@assets/game/pyamong-success.png";
import pyamongBatToss from "@assets/game/pyamong-bat-toss.png";
import baseballBat from "@assets/game/baseball-bat.png";
import pyamongStandsWaiting from "@assets/game/pyamong-stands-waiting.png";
import pyamongWaveGoodbye from "@assets/game/pyamong-wave-goodbye.png";
import type { GameScreenPhase, PredictionOption } from "./gameTypes";
import type { GameDayOverlayKind, GameDayPhase } from "@/lib/gameDayPhase";
import { LIVE_WAIT_BUBBLE_LINES } from "@/lib/gameDayPhase";
import type { InningHalf } from "@shared/gamePhaseTypes";
import { getRunDurationSec, SUCCESS_BAT_TOSS_MS } from "./fieldPositions";
import {
  pyamongBatterReadySrc,
  pyamongRunFrames,
  pyamongWaitingSrc,
} from "./pyamongUniforms";
import {
  BASE_IMAGE_POINTS,
  BATTER_BOX_LEFT_IMAGE,
  BATTER_BOX_RIGHT_IMAGE,
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
import { PYAMONG_ARMS_WAIT_WIDTH, PYAMONG_BATTER_BACK_WIDTH } from "./gameLayoutSizes";
import type { BatterHandSide } from "@shared/batterHandedness";
import "./gameAnimations.css";

const RUN_FRAME_MS = 120;

interface GameCharacterLayerProps {
  phase: GameScreenPhase;
  gameDayPhase: GameDayPhase;
  gameDayOverlayKind?: GameDayOverlayKind | null;
  selectedPrediction: PredictionOption | null;
  battingHalf?: InningHalf | null;
  batsSide?: BatterHandSide | null;
  isPinchHitter?: boolean;
  /** true면 존에 투구가 있음 → wait_start에서 뒷모습(투수 응시), 말풍선 숨김 */
  hideWaitBubble?: boolean;
  onRunComplete?: () => void;
}

function pyamongSpriteClass(_battingHalf: InningHalf | null | undefined, extra = ""): string {
  return extra ? `game-sprite ${extra}` : "game-sprite";
}

function batterBoxPoint(side: BatterHandSide | null | undefined) {
  return side === "left" ? BATTER_BOX_LEFT_IMAGE : BATTER_BOX_RIGHT_IMAGE;
}

function BackBatterReady({
  battingHalf,
  handSide,
  testId,
  badge,
}: {
  battingHalf: InningHalf | null;
  handSide: BatterHandSide;
  testId: string;
  badge?: ReactNode;
}) {
  const isLeftHanded = handSide === "left";
  // 존 쪽 가장자리를 앵커에 두되, 몸통이 과도하게 바깥으로 밀리지 않게
  const anchorTransform = isLeftHanded
    ? "translate(-22%, -100%)"
    : "translate(-78%, -100%)";
  const batterSrc = pyamongBatterReadySrc(battingHalf);
  return (
    <StadiumFieldMarker point={batterBoxPoint(handSide)} center={false}>
      <div
        className={`relative flex items-end pointer-events-none gap-2.5 sm:gap-3 ${
          isLeftHanded ? "flex-row" : "flex-row-reverse"
        }`}
        style={{ transform: anchorTransform }}
        data-testid={testId}
        data-bats-side={handSide}
        data-batting-half={battingHalf ?? ""}
      >
        <div className="shrink-0">
          <img
            src={batterSrc}
            alt=""
            className={`${pyamongSpriteClass(battingHalf)} h-auto shrink-0 drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]`}
            style={{
              width: PYAMONG_BATTER_BACK_WIDTH,
              transformOrigin: "bottom center",
              transform: isLeftHanded ? "scaleX(-1)" : undefined,
            }}
            data-testid="char-batter-back-ready"
            data-bats-side={handSide}
            data-team-side={battingHalf === "bottom" ? "home" : "away"}
          />
        </div>
        {badge}
      </div>
    </StadiumFieldMarker>
  );
}

export default function GameCharacterLayer({
  phase,
  gameDayPhase,
  gameDayOverlayKind = null,
  selectedPrediction,
  battingHalf = null,
  batsSide = null,
  isPinchHitter = false,
  hideWaitBubble = false,
  onRunComplete,
}: GameCharacterLayerProps) {
  const handSide: BatterHandSide = batsSide === "left" ? "left" : "right";
  const [runStyleId] = useState(() => `run-${Math.random().toString(36).slice(2, 9)}`);
  const [runFrameIdx, setRunFrameIdx] = useState(0);
  const [runFaceRight, setRunFaceRight] = useState(true);
  const [batTossing, setBatTossing] = useState(false);
  const fieldSize = useStadiumFieldSize();
  const runTarget = selectedPrediction ?? "1루";
  const runPath = useMemo(() => getRunPathImagePoints(runTarget), [runTarget]);
  const runDurationSec = useMemo(() => getRunDurationSec(runTarget), [runTarget]);
  const batTossMs = SUCCESS_BAT_TOSS_MS;

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
      setBatTossing(false);
      return;
    }

    setBatTossing(true);
    const t = setTimeout(() => setBatTossing(false), SUCCESS_BAT_TOSS_MS);
    return () => clearTimeout(t);
  }, [phase, runTarget]);

  useEffect(() => {
    if (phase !== "success_running") return;
    const ms = batTossMs + runDurationSec * 1000 + 100;
    const t = setTimeout(() => onRunComplete?.(), ms);
    return () => clearTimeout(t);
  }, [phase, runDurationSec, batTossMs, onRunComplete]);

  useEffect(() => {
    if (phase !== "success_running" || batTossing) {
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
      setRunFrameIdx(Math.floor(elapsed / RUN_FRAME_MS) % pyamongRunFrames(battingHalf).length);
      setRunFaceRight(getRunFacingRight(runPath, Math.min(1, elapsed / durationMs)));
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phase, runDurationSec, runPath, batTossing, battingHalf]);

  const predictionBadge =
    selectedPrediction && phase === "wait_result" ? (
      <div
        className="mb-[min(12%,20px)] shrink-0 rounded-xl border-2 border-[#CDFF00] bg-black/75 px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-lg"
        data-testid="wait-result-prediction-badge"
      >
        <p className="text-[10px] sm:text-xs text-white/70 leading-none mb-1">내 예측</p>
        <p className="text-sm sm:text-base font-bold text-[#CDFF00] leading-none whitespace-nowrap">
          {selectedPrediction}
        </p>
      </div>
    ) : null;

  return (
    <>
      <style>{keyframesCss}</style>

      {gameDayPhase === "pregame" && !gameDayOverlayKind && (
        <StadiumFieldMarker point={STANDS_SEAT_IMAGE} center={false}>
          <div className="pointer-events-none" style={{ transform: "translate(-50%, -92%)" }}>
            <img
              src={pyamongStandsWaiting}
              alt=""
              className="w-[min(16vw,120px)] h-auto game-sprite game-sprite-tint-away animate-pyamong-idle shrink-0"
              style={{ transformOrigin: "bottom center" }}
              data-testid="char-pyamong-stands-waiting"
            />
          </div>
        </StadiumFieldMarker>
      )}

      {gameDayOverlayKind === "no_match" && (
        <StadiumFieldMarker point={STANDS_SEAT_IMAGE} center={false}>
          <div className="pointer-events-none" style={{ transform: "translate(-50%, -92%)" }}>
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
          <div className="pointer-events-none" style={{ transform: "translate(-50%, -92%)" }}>
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
          <div className="pointer-events-none" style={{ transform: "translate(-50%, -92%)" }}>
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
          <div className="pointer-events-none" style={{ transform: "translate(-50%, -92%)" }}>
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

      {/* 1. 예측 시작 전: 팔짱 빠몽 (존 투구와 무관) */}
      {gameDayPhase === "live" && phase === "wait_start" ? (
        <StadiumFieldMarker point={batterBoxPoint(handSide)} center={false}>
          <div
            className={`flex items-end gap-1 sm:gap-2 pointer-events-none ${
              handSide === "left" ? "flex-row" : "flex-row-reverse"
            }`}
            style={{ transform: "translate(-50%, -92%)" }}
            data-testid="char-batter-box-wait-start"
            data-bats-side={handSide}
          >
            <img
              src={pyamongWaitingSrc(battingHalf)}
              alt=""
              className={`${pyamongSpriteClass(battingHalf)} h-auto shrink-0 drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]`}
              style={{ width: PYAMONG_ARMS_WAIT_WIDTH, transformOrigin: "bottom center" }}
              data-testid="char-pyamong-arms-waiting"
            />
            {!hideWaitBubble ? (
              <GameThoughtBubble
                lines={
                  isPinchHitter
                    ? (["대타가", "나옵니다"] as const)
                    : [...LIVE_WAIT_BUBBLE_LINES]
                }
                className="mb-[min(5vw,40px)] shrink-0"
                bubbleWidth="min(10vw, 78px)"
                textClassName="text-[min(2.1vw,11px)] sm:text-[min(2.5vw,13px)] leading-[1.12]"
              />
            ) : null}
          </div>
        </StadiumFieldMarker>
      ) : null}

      {/* 2. 예측 시작(picking): 빠몽 숨김 — 베이스 버튼만 */}

      {/* 3. 예측 중지·결과 큰 글씨: 방망이 든 뒷모습 */}
      {gameDayPhase === "live" && (phase === "wait_result" || phase === "result_flash") ? (
        <BackBatterReady
          battingHalf={battingHalf}
          handSide={handSide}
          testId={phase === "result_flash" ? "char-batter-box-result-flash" : "char-batter-box-wait-result"}
          badge={phase === "wait_result" ? predictionBadge : undefined}
        />
      ) : null}

      {phase === "success_running" && batTossing && (
        <>
          <div
            className="absolute z-[21] pointer-events-none"
            style={{
              left: homePx.left,
              top: homePx.top,
              transform: "translate(-50%, -100%)",
            }}
            data-testid="char-success-bat-toss"
          >
            <img
              src={pyamongBatToss}
              alt=""
              className={pyamongSpriteClass(
                battingHalf,
                "w-[min(9vw,72px)] h-auto animate-home-run-toss-pose",
              )}
              data-testid="char-pyamong-bat-toss"
            />
          </div>
          <div
            className="absolute inset-0 z-[47] pointer-events-none overflow-hidden"
            data-testid="success-bat-fill-overlay"
          >
            <div className="absolute inset-0 animate-success-bat-scrim bg-black/50" />
            <div className="absolute left-1/2 top-1/2 animate-success-bat-fill">
              <div className="relative">
                <img
                  src={baseballBat}
                  alt=""
                  className="w-[min(46vw,320px)] h-auto drop-shadow-[0_8px_24px_rgba(0,0,0,0.65)]"
                  data-testid="prop-success-bat"
                />
                <span
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[48deg] text-[#2a1206] font-black tracking-[0.18em] whitespace-nowrap"
                  style={{
                    fontSize: "clamp(18px, 4.2vw, 36px)",
                    textShadow:
                      "0 1px 0 rgba(255,244,220,0.85), 0 0 10px rgba(255,236,200,0.45)",
                  }}
                  data-testid="prop-success-bat-label"
                >
                  빠던나인
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {phase === "success_running" && !batTossing && (
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
              src={pyamongRunFrames(battingHalf)[runFrameIdx]}
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

      {phase === "success_announce" && (
        <StadiumFieldMarker point={HOME_PLATE_IMAGE} center={false}>
          <div style={{ transform: "translate(-50%, -100%)" }}>
            <img
              src={pyamongSuccess}
              alt=""
              className={pyamongSpriteClass(
                battingHalf,
                "w-[min(10vw,78px)] h-auto animate-pyamong-success-home",
              )}
              data-testid="char-pyamong-success-announce"
            />
          </div>
        </StadiumFieldMarker>
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
                  runTarget === "홈런" ? "animate-pyamong-hop-home" : "animate-pyamong-hop"
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
              src={pyamongWaitingSrc(battingHalf)}
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
              src={pyamongWaitingSrc(
                battingHalf === "top" ? "bottom" : battingHalf === "bottom" ? "top" : null,
              )}
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
              src={pyamongWaitingSrc(battingHalf)}
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
