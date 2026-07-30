import type { PredictionOption } from "./gameTypes";
import { FIELD_LABEL_TEXT, FIELD_POSITIONS } from "./fieldPositions";

interface GameFieldLabelsProps {
  visible: boolean;
  interactive: boolean;
  selectedPrediction: PredictionOption | null;
  highlightPrediction: PredictionOption | null;
  blinkPrediction: PredictionOption | null;
  onSelect?: (option: PredictionOption) => void;
}

const OPTIONS: PredictionOption[] = ["홈런", "3루", "2루", "1루", "아웃"];

export default function GameFieldLabels({
  visible,
  interactive,
  selectedPrediction,
  highlightPrediction,
  blinkPrediction,
  onSelect,
}: GameFieldLabelsProps) {
  if (!visible) return null;

  return (
    <div
      className={`absolute inset-0 z-10 ${interactive ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!interactive}
    >
      {OPTIONS.map((key) => {
        const pos = FIELD_POSITIONS[key];
        const isSelected = selectedPrediction === key || highlightPrediction === key;
        const isBlink = blinkPrediction === key;
        return (
          <button
            key={key}
            type="button"
            disabled={!interactive}
            onClick={() => onSelect?.(key)}
            className={`absolute -translate-x-1/2 -translate-y-1/2 font-bold text-lg sm:text-xl md:text-2xl drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] transition-transform ${
              isSelected ? "text-[#FFE566] scale-110" : "text-[#E11936]"
            } ${isBlink ? "animate-label-blink" : ""} ${interactive ? "cursor-pointer hover:scale-110 active:scale-95" : ""}`}
            style={{ left: pos.left, top: pos.top }}
            data-testid={`field-label-${key}`}
          >
            {FIELD_LABEL_TEXT[key]}
          </button>
        );
      })}
    </div>
  );
}
