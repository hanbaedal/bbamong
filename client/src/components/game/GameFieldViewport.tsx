import type { ReactNode, RefObject } from "react";
import { STADIUM_ASPECT_RATIO } from "./stadiumFieldCoords";
import { StadiumFieldProvider, useStadiumFieldContainer } from "./StadiumFieldContext";
import GameStadiumBackground from "./GameStadiumBackground";
import type { GameSceneKind } from "./gameSceneBackground";

export { STADIUM_ASPECT_RATIO };

interface GameFieldViewportProps {
  children: ReactNode;
  sceneKind?: GameSceneKind;
}

function GameFieldViewportInner({
  children,
  sceneKind = "field",
}: GameFieldViewportProps) {
  const { containerRef } = useStadiumFieldContainer();

  return (
    <div
      ref={containerRef as RefObject<HTMLDivElement>}
      className="absolute inset-0 w-full h-full overflow-hidden bg-[#0c1520]"
      data-testid="game-field-viewport"
      data-scene={sceneKind}
    >
      <GameStadiumBackground sceneKind={sceneKind} />
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}

/**
 * 풀스크린 경기장 — field·running·시네마틱 모두 object-cover.
 * 예측 선택 좌표는 field(game-stadium-field.jpg), 주루 좌표는 running(scene-running.jpg).
 */
export default function GameFieldViewport({
  children,
  sceneKind = "field",
}: GameFieldViewportProps) {
  return (
    <StadiumFieldProvider>
      <GameFieldViewportInner sceneKind={sceneKind}>{children}</GameFieldViewportInner>
    </StadiumFieldProvider>
  );
}
