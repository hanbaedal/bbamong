import fieldStadiumBg from "@assets/game/game-stadium-field.jpg";
import sceneBefore from "@assets/game/scene-before.jpg";
import sceneWaitAway from "@assets/game/scene-wait-away.jpg";
import sceneWaitHome from "@assets/game/scene-wait-home.jpg";
import scenePitchAway from "@assets/game/scene-pitch-away.jpg";
import scenePitchHome from "@assets/game/scene-pitch-home.jpg";
import { isCinematicGameScene, type GameSceneKind } from "./gameSceneBackground";

const SCENE_SRC: Record<GameSceneKind, string> = {
  field: fieldStadiumBg,
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

/** 필드·시네마틱 모두 object-cover. 필드만 베이스 좌표를 이 이미지에 맞춘다. */
export default function GameStadiumBackground({
  sceneKind = "field",
}: GameStadiumBackgroundProps) {
  const src = SCENE_SRC[sceneKind];
  const cinematic = isCinematicGameScene(sceneKind);

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
        data-testid={cinematic ? "game-cinematic-bg" : "game-stadium-bg-center"}
      />
    </div>
  );
}
