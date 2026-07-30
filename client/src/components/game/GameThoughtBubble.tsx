import speechBubbleImg from "@assets/game/speech-bubble-thought.png";
import { THOUGHT_BUBBLE_WIDTH } from "./gameLayoutSizes";

interface GameThoughtBubbleProps {
  text: string;
  className?: string;
}

/** 빠몽이 위 말풍선 — 빠몽이 너비의 50% */
export default function GameThoughtBubble({ text, className = "" }: GameThoughtBubbleProps) {
  return (
    <div
      className={`relative shrink-0 ${className}`}
      data-testid="game-thought-bubble"
      style={{ width: THOUGHT_BUBBLE_WIDTH, aspectRatio: "1.35 / 1" }}
    >
      <img
        src={speechBubbleImg}
        alt=""
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        draggable={false}
      />
      <p
        className="absolute inset-0 flex items-center justify-center px-[12%] pt-[6%] pb-[18%] text-[#FFE566] text-[5px] sm:text-[6px] font-bold leading-[1.15] text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]"
        data-testid="text-wait-start"
      >
        {text}
      </p>
    </div>
  );
}
