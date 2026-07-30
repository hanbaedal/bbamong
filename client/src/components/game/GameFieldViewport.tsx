import type { ReactNode } from "react";
import stadiumBg from "@assets/game/game-stadium-bg.png";

/** 경기장 배경 PNG 실제 비율 (1536×1024 = 3:2) */
export const STADIUM_ASPECT_RATIO = 1536 / 1024;

interface GameFieldViewportProps {
  children: ReactNode;
}

/**
 * 풀스크린(100dvw×100dvh) 경기장 — 좌측 메뉴는 shell에서 오버레이.
 * object-cover로 가로·세로 꽉 채우고, 라벨 %는 cover 기준으로 fieldPositions.ts 에 맞춤.
 */
export default function GameFieldViewport({ children }: GameFieldViewportProps) {
  return (
    <div
      className="absolute inset-0 w-full h-full overflow-hidden"
      data-testid="game-field-viewport"
    >
      <img
        src={stadiumBg}
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-[42%_center] pointer-events-none select-none"
        draggable={false}
      />
      {/* 배경 PNG 우측 전광판·조명 — UI 스코어보드와 겹치지 않게 가림 */}
      <div
        className="pointer-events-none absolute right-0 top-0 z-[1] h-[34%] w-[28%] bg-gradient-to-bl from-[#0c1520]/95 via-[#162030]/75 to-transparent"
        aria-hidden
        data-testid="stadium-jumbotron-mask"
      />
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}
