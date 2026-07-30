import type { ReactNode, RefObject } from "react";
import stadiumBg from "@assets/game/game-stadium-bg.png";
import { StadiumFieldProvider, useStadiumFieldContainer } from "./StadiumFieldContext";

/** 경기장 배경 PNG 실제 비율 (1536×1024 = 3:2) */
export const STADIUM_ASPECT_RATIO = 1536 / 1024;

interface GameFieldViewportProps {
  children: ReactNode;
}

function GameFieldViewportInner({ children }: GameFieldViewportProps) {
  const { containerRef } = useStadiumFieldContainer();

  return (
    <div
      ref={containerRef as RefObject<HTMLDivElement>}
      className="absolute inset-0 w-full h-full overflow-hidden bg-black"
      data-testid="game-field-viewport"
    >
      <img
        src={stadiumBg}
        alt=""
        className="absolute inset-0 w-full h-full object-contain object-center pointer-events-none select-none"
        draggable={false}
      />
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
 * 풀스크린 경기장 — object-contain 으로 이미지 전체(홈플레이트 포함) 표시.
 * UI 좌표는 stadiumFieldCoords.ts 이미지 정규 좌표 + contain 변환.
 */
export default function GameFieldViewport({ children }: GameFieldViewportProps) {
  return (
    <StadiumFieldProvider>
      <GameFieldViewportInner>{children}</GameFieldViewportInner>
    </StadiumFieldProvider>
  );
}
