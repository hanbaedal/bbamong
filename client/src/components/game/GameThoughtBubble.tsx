import speechBubbleImg from "@assets/game/speech-bubble-thought.png";

interface GameThoughtBubbleProps {
  text: string;
  className?: string;
}

/** 빠몽이 오른쪽 말풍선 — 빨간 테두리 PNG + 노란 글씨 (시안) */
export default function GameThoughtBubble({ text, className = "" }: GameThoughtBubbleProps) {
  return (
    <div
      className={`relative shrink-0 ${className}`}
      data-testid="game-thought-bubble"
      style={{ width: "min(38vw, 260px)", aspectRatio: "1.35 / 1" }}
    >
      <img
        src={speechBubbleImg}
        alt=""
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        draggable={false}
      />
      <p
        className="absolute inset-0 flex items-center justify-center px-[18%] pt-[8%] pb-[22%] text-[#FFE566] text-[9px] sm:text-[11px] font-bold leading-snug text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]"
        data-testid="text-wait-start"
      >
        {text}
      </p>
    </div>
  );
}
