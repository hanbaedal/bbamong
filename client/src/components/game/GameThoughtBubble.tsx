import speechBubbleImg from "@assets/game/speech-bubble-thought.png";
import { THOUGHT_BUBBLE_WIDTH } from "./gameLayoutSizes";

interface GameThoughtBubbleProps {
  text: string;
  className?: string;
}

/** 빠몽이 옆 말풍선 */
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
        className="absolute inset-0 flex items-center justify-center px-[10%] pt-[5%] pb-[16%] text-[#FFE566] text-[min(2.4vw,13px)] sm:text-[min(2.8vw,15px)] font-bold leading-[1.2] text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]"
        data-testid="text-wait-start"
      >
        {text}
      </p>
    </div>
  );
}
