import type { ReactNode } from "react";
import stadiumBg from "@assets/game/game-stadium-bg.png";

/** 경기장 배경 PNG 실제 비율 (1536×1024 = 3:2) */
export const STADIUM_ASPECT_RATIO = 1536 / 1024;

interface GameFieldViewportProps {
  children: ReactNode;
}

/**
 * 스마트폰 가로 화면: 경기장 PNG 전체(플랫폼·외야·담장)가 잘리지 않도록
 * 이미지와 동일한 3:2 박스를 가용 영역 안에 맞춤.
 * 필드 라벨·캐릭터 % 좌표는 이 박스 기준 — 배경과 1:1 정렬.
 */
export default function GameFieldViewport({ children }: GameFieldViewportProps) {
  return (
    <div className="flex-1 min-w-0 min-h-0 flex items-center justify-center bg-black">
      <div
        className="relative h-full max-w-full w-auto"
        style={{ aspectRatio: STADIUM_ASPECT_RATIO }}
        data-testid="game-field-viewport"
      >
        <img
          src={stadiumBg}
          alt=""
          className="absolute inset-0 w-full h-full pointer-events-none select-none"
          draggable={false}
        />
        <div className="absolute inset-0">{children}</div>
      </div>
    </div>
  );
}
