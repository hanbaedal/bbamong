import type { ReactNode, RefObject } from "react";
import { STADIUM_ASPECT_RATIO } from "./stadiumFieldCoords";
import { StadiumFieldProvider, useStadiumFieldContainer } from "./StadiumFieldContext";
import GameStadiumBackground from "./GameStadiumBackground";

export { STADIUM_ASPECT_RATIO };

interface GameFieldViewportProps {
  children: ReactNode;
}

function GameFieldViewportInner({ children }: GameFieldViewportProps) {
  const { containerRef } = useStadiumFieldContainer();

  return (
    <div
      ref={containerRef as RefObject<HTMLDivElement>}
      className="absolute inset-0 w-full h-full overflow-hidden bg-[#0c1520]"
      data-testid="game-field-viewport"
    >
      <GameStadiumBackground />
      <div
        className="pointer-events-none absolute right-0 top-0 z-[1] h-[34%] w-[28%] bg-gradient-to-bl from-[#0c1520]/95 via-[#162030]/75 to-transparent"
        aria-hidden
        data-testid="stadium-jumbotron-mask"
      />
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}

/**
 * 풀스크린 경기장 — 중앙 3:2 원본 + 좌·우 관중석 미러 확장 → 16:9 풀페이지.
 * UI 좌표는 중앙 원본 이미지 기준 (stadiumFieldCoords.ts).
 */
export default function GameFieldViewport({ children }: GameFieldViewportProps) {
  return (
    <StadiumFieldProvider>
      <GameFieldViewportInner>{children}</GameFieldViewportInner>
    </StadiumFieldProvider>
  );
}
