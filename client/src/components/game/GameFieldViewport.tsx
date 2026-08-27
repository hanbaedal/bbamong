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
 * 풀스크린 경기장 — field·시네마틱 모두 object-cover.
 * 베이스 버튼·주루 좌표는 field 장면의 game-stadium-field.jpg 기준.
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
