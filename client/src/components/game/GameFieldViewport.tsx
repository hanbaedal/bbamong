import type { ReactNode, RefObject } from "react";
import { STADIUM_ASPECT_RATIO } from "./stadiumFieldCoords";
import { StadiumFieldProvider, useStadiumFieldContainer } from "./StadiumFieldContext";
import GameStadiumBackground from "./GameStadiumBackground";
import { isCinematicGameScene, type GameSceneKind } from "./gameSceneBackground";

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
  const cinematic = isCinematicGameScene(sceneKind);

  return (
    <div
      ref={containerRef as RefObject<HTMLDivElement>}
      className="absolute inset-0 w-full h-full overflow-hidden bg-[#0c1520]"
      data-testid="game-field-viewport"
      data-scene={sceneKind}
    >
      <GameStadiumBackground sceneKind={sceneKind} />
      {!cinematic ? (
        <>
          {/* 배경 PNG 중앙 전광판 — 주변 불빛/글로우 흐림 */}
          <div
            className="pointer-events-none absolute left-1/2 top-0 z-[1] h-[30%] w-[46%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(12,21,32,0.78)_0%,rgba(12,21,32,0.42)_52%,transparent_78%)] backdrop-blur-[6px] backdrop-saturate-[0.7]"
            aria-hidden
            data-testid="stadium-center-jumbotron-softener"
          />
          {/* 우측 UI 스코어보드 뒤 배경 하이라이트 완화 */}
          <div
            className="pointer-events-none absolute right-0 top-0 z-[1] h-[36%] w-[30%] bg-gradient-to-bl from-[#0c1520]/88 via-[#162030]/45 to-transparent backdrop-blur-[8px] backdrop-saturate-[0.8]"
            aria-hidden
            data-testid="stadium-jumbotron-mask"
          />
        </>
      ) : null}
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}

/**
 * 풀스크린 경기장 — field 장면은 중앙 3:2 원본 + 좌·우 관중석 미러.
 * 시네마틱 장면은 object-cover 풀블리드 (필드 좌표 미사용).
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
