import { useEffect } from "react";
import pyamongWaveGoodbye from "@assets/game/pyamong-wave-goodbye.png";
import GameThoughtBubble from "./GameThoughtBubble";
import { DAY_END_BUBBLE_LINES, GAME_DAY_END_REDIRECT_MS } from "@/lib/gameDayPhase";

interface GameDayEndScreenProps {
  onComplete: () => void;
}

/** 오늘 경기 전부 종료 — 손 흔드는 빠몽이 + 3초 후 콜백 */
export default function GameDayEndScreen({ onComplete }: GameDayEndScreenProps) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, GAME_DAY_END_REDIRECT_MS);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 pointer-events-none"
      data-testid="game-day-end-screen"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-row items-end justify-center gap-2 sm:gap-4 px-4">
        <img
          src={pyamongWaveGoodbye}
          alt=""
          className="w-[min(22vw,140px)] h-auto game-sprite animate-pyamong-wave shrink-0 drop-shadow-[0_4px_16px_rgba(0,0,0,0.55)]"
          data-testid="char-pyamong-day-end"
        />
        <GameThoughtBubble
          lines={[...DAY_END_BUBBLE_LINES]}
          className="mb-[min(6vw,48px)] shrink-0"
          bubbleWidth="min(14vw, 108px)"
          textClassName="text-[min(2.2vw,12px)] sm:text-[min(2.6vw,14px)] leading-[1.15]"
        />
      </div>
    </div>
  );
}
