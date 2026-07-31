import speechBubbleImg from "@assets/game/speech-bubble-thought.png";
import { THOUGHT_BUBBLE_WIDTH } from "./gameLayoutSizes";

interface GameThoughtBubbleProps {
  /** 한 줄 문자열 (legacy) */
  text?: string;
  /** 줄별 멘트 — text보다 우선 */
  lines?: string[];
  className?: string;
  bubbleWidth?: string;
  textClassName?: string;
}

/** 빠몽이 옆 말풍선 */
export default function GameThoughtBubble({
  text,
  lines,
  className = "",
  bubbleWidth = THOUGHT_BUBBLE_WIDTH,
  textClassName = "text-[min(2.4vw,13px)] sm:text-[min(2.8vw,15px)] leading-[1.2]",
}: GameThoughtBubbleProps) {
  const content =
    lines && lines.length > 0 ? (
      lines.map((line, i) => (
        <span key={i} className="block">
          {line}
        </span>
      ))
    ) : (
      text
    );

  return (
    <div
      className={`relative shrink-0 ${className}`}
      data-testid="game-thought-bubble"
      style={{ width: bubbleWidth, aspectRatio: "1.35 / 1" }}
    >
      <img
        src={speechBubbleImg}
        alt=""
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        draggable={false}
      />
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center px-[10%] pt-[5%] pb-[16%] text-[#FFE566] font-bold text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] ${textClassName}`}
        data-testid="text-wait-start"
      >
        {content}
      </div>
    </div>
  );
}
