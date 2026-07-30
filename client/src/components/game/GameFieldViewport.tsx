import type { ReactNode } from "react";
import stadiumBg from "@assets/game/game-stadium-bg.png";

/** 경기장 배경 PNG 비율 (가로:세로) — 시안 mockup 기준 */
export const STADIUM_ASPECT_RATIO = 16 / 9;

interface GameFieldViewportProps {
  children: ReactNode;
}

/**
 * 스마트폰 가로 화면: 16:9 경기장 이미지가 잘리지 않고 전체 표시되도록 맞춤.
 * 필드 라벨·캐릭터 % 좌표는 이 뷰포트 기준.
 */
export default function GameFieldViewport({ children }: GameFieldViewportProps) {
  return (
    <div className="flex-1 min-w-0 min-h-0 grid place-items-center bg-black">
      <div
        className="relative aspect-video w-full h-full max-w-full max-h-full"
        data-testid="game-field-viewport"
      >
        <img
          src={stadiumBg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
          draggable={false}
        />
        <div className="absolute inset-0">{children}</div>
      </div>
    </div>
  );
}
