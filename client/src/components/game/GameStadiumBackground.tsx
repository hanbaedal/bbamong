import stadiumBg from "@assets/game/game-stadium-bg.png";
import sceneBefore from "@assets/game/scene-before.jpg";
import sceneWaitAway from "@assets/game/scene-wait-away.jpg";
import sceneWaitHome from "@assets/game/scene-wait-home.jpg";
import scenePitchAway from "@assets/game/scene-pitch-away.jpg";
import scenePitchHome from "@assets/game/scene-pitch-home.jpg";
import { STADIUM_ASPECT_RATIO } from "./stadiumFieldCoords";
import { isCinematicGameScene, type GameSceneKind } from "./gameSceneBackground";

const SCENE_SRC: Record<GameSceneKind, string> = {
  field: stadiumBg,
  before: sceneBefore,
  wait_away: sceneWaitAway,
  wait_home: sceneWaitHome,
  pitch_away: scenePitchAway,
  pitch_home: scenePitchHome,
};

interface GameStadiumBackgroundProps {
  sceneKind?: GameSceneKind;
}

function ScenePreload() {
  return (
    <div className="hidden" aria-hidden>
      {(Object.entries(SCENE_SRC) as [GameSceneKind, string][]).map(([kind, src]) => (
        <img key={kind} src={src} alt="" />
      ))}
    </div>
  );
}

/** viewport 가로가 더 넓을 때: 높이 100% 기준 3:2 중앙 + 좌우 미러 관중석 */
export default function GameStadiumBackground({
  sceneKind = "field",
}: GameStadiumBackgroundProps) {
  const src = SCENE_SRC[sceneKind];

  if (isCinematicGameScene(sceneKind)) {
    return (
      <div
        className="absolute inset-0 overflow-hidden bg-[#0c1520]"
        data-testid="game-stadium-background"
        data-scene={sceneKind}
      >
        <ScenePreload />
        <img
          src={src}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover pointer-events-none select-none"
          data-testid="game-cinematic-bg"
        />
      </div>
    );
  }

  const sideWidth = `max(0px, calc((100dvw - 100dvh * ${STADIUM_ASPECT_RATIO}) / 2))`;

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[#0c1520]"
      data-testid="game-stadium-background"
      data-scene="field"
    >
      <ScenePreload />
      {/* 좌측 — 왼쪽 관중석 구간 미러 */}
      <div
        className="absolute top-0 bottom-0 left-0 overflow-hidden pointer-events-none"
        style={{ width: sideWidth }}
        aria-hidden
      >
        <img
          src={stadiumBg}
          alt=""
          draggable={false}
          className="absolute top-0 h-full max-w-none scale-x-[-1] object-cover"
          style={{ width: "auto", minWidth: "200%", left: 0, objectPosition: "22% center" }}
        />
      </div>

      {/* 중앙 — 원본 3:2 전체(높이 100%) */}
      <img
        src={stadiumBg}
        alt=""
        draggable={false}
        className="absolute top-0 left-1/2 h-full w-auto max-w-none -translate-x-1/2 pointer-events-none select-none"
        style={{ aspectRatio: `${STADIUM_ASPECT_RATIO}` }}
        data-testid="game-stadium-bg-center"
      />

      {/* 우측 — 오른쪽 관중석 구간 미러 */}
      <div
        className="absolute top-0 bottom-0 right-0 overflow-hidden pointer-events-none"
        style={{ width: sideWidth }}
        aria-hidden
      >
        <img
          src={stadiumBg}
          alt=""
          draggable={false}
          className="absolute top-0 right-0 h-full max-w-none scale-x-[-1] object-cover"
          style={{ width: "auto", minWidth: "200%", objectPosition: "78% center" }}
        />
      </div>
    </div>
  );
}
