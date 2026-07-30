type PredictionOption = "1루" | "2루" | "3루" | "홈런" | "아웃";

const FIELD_LABELS: { key: PredictionOption; label: string; className: string }[] = [
  { key: "홈런", label: "홈런", className: "left-[58%] top-[18%]" },
  { key: "3루", label: "3", className: "left-[72%] top-[38%]" },
  { key: "2루", label: "2", className: "left-[58%] top-[48%]" },
  { key: "1루", label: "1", className: "left-[72%] top-[58%]" },
  { key: "아웃", label: "아웃", className: "left-[50%] top-[68%]" },
];

/** 1차: 위치·스타일만 (탭 예측 제출은 다음 단계) */
export default function GameFieldLabels() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {FIELD_LABELS.map((item) => (
        <span
          key={item.key}
          className={`absolute -translate-x-1/2 -translate-y-1/2 text-[#E11936] font-bold text-lg sm:text-xl md:text-2xl drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${item.className}`}
          data-testid={`field-label-${item.key}`}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}
