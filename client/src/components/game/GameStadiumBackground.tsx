import { useEffect } from "react";
import fieldStadiumBg from "@assets/game/game-stadium-field.jpg";
import sceneBefore from "@assets/game/scene-before.jpg";
import sceneRunning from "@assets/game/scene-running.jpg";
import sceneWaitAway from "@assets/game/scene-wait-away.jpg";
import sceneWaitHome from "@assets/game/scene-wait-home.jpg";
import scenePitchAway from "@assets/game/scene-pitch-away.jpg";
import scenePitchHome from "@assets/game/scene-pitch-home.jpg";
import { isCinematicGameScene, type GameSceneKind } from "./gameSceneBackground";

const SCENE_SRC: Record<GameSceneKind, string> = {
  field: fieldStadiumBg,
  running: sceneRunning,
  before: sceneBefore,
  wait_away: sceneWaitAway,
  wait_home: sceneWaitHome,
  pitch_away: scenePitchAway,
  pitch_home: scenePitchHome,
};

interface GameStadiumBackgroundProps {
  sceneKind?: GameSceneKind;
  /** 좌타 결과대기(투구 사진)만 반전 — 대기 원정/홈 사진은 원본 구도 유지 */
  mirrorX?: boolean;
}

/** 현재 장면만 먼저 받고, 나머지는 유휴 때 받아 진입 대역폭을 뺏지 않는다. */
function SceneIdlePreload({ current }: { current: GameSceneKind }) {
  useEffect(() => {
    const rest = (Object.entries(SCENE_SRC) as [GameSceneKind, string][])
      .filter(([kind]) => kind !== current)
      .map(([, src]) => src);

    const run = () => {
      for (const src of rest) {
        const img = new Image();
        img.decoding = "async";
        img.src = src;
      }
    };

    const ric = window.requestIdleCallback?.bind(window);
    if (typeof ric === "function") {
      const id = ric(run, { timeout: 2500 });
      return () => window.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(run, 1);
    return () => window.clearTimeout(timer);
  }, [current]);

  return null;
}

/** 필드·주루·시네마틱 모두 object-cover. 베이스 좌표는 field / running 각각. */
export default function GameStadiumBackground({
  sceneKind = "field",
  mirrorX = false,
}: GameStadiumBackgroundProps) {
  const src = SCENE_SRC[sceneKind];
  const cinematic = isCinematicGameScene(sceneKind);

  const waitScene = sceneKind === "wait_away" || sceneKind === "wait_home";

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[#0c1520]"
      data-testid="game-stadium-background"
      data-scene={sceneKind}
    >
      <SceneIdlePreload current={sceneKind} />
      {waitScene ? (
        <img
          src={src}
          alt=""
          draggable={false}
          decoding="async"
          fetchPriority="high"
          className={`absolute inset-0 h-full w-full object-cover blur-md scale-110 opacity-70 pointer-events-none select-none ${mirrorX ? "-scale-x-100" : ""}`}
          aria-hidden
        />
      ) : null}
      <img
        src={src}
        alt=""
        draggable={false}
        decoding="async"
        fetchPriority="high"
        className={`absolute inset-0 h-full w-full object-cover pointer-events-none select-none ${mirrorX ? "-scale-x-100" : ""}`}
        data-testid={cinematic ? "game-cinematic-bg" : "game-stadium-bg-center"}
        data-mirror={mirrorX ? "x" : undefined}
      />
    </div>
  );
}
