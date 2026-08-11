import type { PredictionOption } from "./gameTypes";
import { FIELD_LABEL_TEXT } from "./fieldPositions";
import { BASE_IMAGE_POINTS } from "./stadiumFieldCoords";
import { StadiumFieldMarker } from "./StadiumFieldContext";

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
      className="absolute inset-0 z-10 pointer-events-none"
      aria-hidden={!interactive}
    >
      {OPTIONS.map((key) => {
        // 결과 대기 중에는 예측한 라벨만 표시 (빨간 깜빡임)
        if (blinkPrediction != null && key !== blinkPrediction) return null;

        const isSelected = selectedPrediction === key || highlightPrediction === key;
        const isBlink = blinkPrediction === key;
        return (
          <StadiumFieldMarker key={key} point={BASE_IMAGE_POINTS[key]}>
            <button
              type="button"
              disabled={!interactive}
              onClick={() => onSelect?.(key)}
              className={`pointer-events-auto min-w-[2.75rem] sm:min-w-[3.25rem] rounded-full border-2 px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-bold whitespace-nowrap shadow-[0_2px_8px_rgba(0,0,0,0.55)] transition-transform ${
                isSelected || isBlink
                  ? "border-[#E11936] bg-[#E11936]/90 text-white scale-110"
                  : "border-[#FFE566] bg-black/75 text-[#FFE566]"
              } ${isBlink ? "animate-label-blink" : ""} ${
                interactive ? "cursor-pointer hover:scale-110 active:scale-95" : ""
              }`}
              data-testid={`field-label-${key}`}
            >
              {FIELD_LABEL_TEXT[key]}
            </button>
          </StadiumFieldMarker>
        );
      })}
    </div>
  );
}
