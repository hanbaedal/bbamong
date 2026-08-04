import { ChevronDown, ChevronUp, Minus, Plus } from "lucide-react";

interface SpinnerFieldProps {
  label?: string;
  value: string;
  onIncrease: () => void;
  onDecrease: () => void;
  canIncrease: boolean;
  canDecrease: boolean;
  disabled?: boolean;
  testId?: string;
  compact?: boolean;
  /** vertical: ▲▼ / horizontal: − 숫자 + */
  layout?: "vertical" | "horizontal";
}

/** 증감 + 중앙 표시 (점수·포인트 공용) */
export default function SpinnerField({
  label,
  value,
  onIncrease,
  onDecrease,
  canIncrease,
  canDecrease,
  disabled = false,
  testId,
  compact = false,
  layout = "vertical",
}: SpinnerFieldProps) {
  if (layout === "horizontal") {
    const rowH = compact
      ? "h-9 max-sm:min-h-[40px] sm:h-8"
      : "h-10 max-sm:min-h-[44px] sm:h-9";
    const iconCls = compact ? "h-3.5 w-3.5" : "h-4 w-4";

    return (
      <div className="min-w-0" data-testid={testId}>
        {label ? (
          <p
            className={`mb-1 truncate text-center text-[#888] ${
              compact ? "text-[10px] sm:text-[9px]" : "text-xs sm:text-[10px]"
            }`}
          >
            {label}
          </p>
        ) : null}
        <div
          className={`flex ${rowH} overflow-hidden rounded-md border border-[#373539] bg-[#141414]`}
          role="group"
          aria-label={label ?? "값 선택"}
        >
          <button
            type="button"
            disabled={disabled || !canDecrease}
            onClick={onDecrease}
            aria-label={`${label ?? "값"} 내리기`}
            className="flex w-9 shrink-0 items-center justify-center border-r border-[#373539] text-[#AAA] transition-colors enabled:hover:bg-[#1f1f1f] enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-8"
          >
            <Minus className={iconCls} strokeWidth={2.5} />
          </button>
          <div
            className={`flex min-w-0 flex-1 items-center justify-center font-semibold tabular-nums text-white ${
              compact ? "text-sm sm:text-xs" : "text-base sm:text-sm"
            }`}
            aria-live="polite"
            data-testid={testId ? `${testId}-value` : undefined}
          >
            {value}
          </div>
          <button
            type="button"
            disabled={disabled || !canIncrease}
            onClick={onIncrease}
            aria-label={`${label ?? "값"} 올리기`}
            className="flex w-9 shrink-0 items-center justify-center border-l border-[#373539] text-[#AAA] transition-colors enabled:hover:bg-[#1f1f1f] enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-8"
          >
            <Plus className={iconCls} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    );
  }

  const btnH = compact
    ? "h-8 max-sm:min-h-[44px] sm:h-6"
    : "h-9 max-sm:min-h-[44px]";
  const valH = compact
    ? "h-10 text-base max-sm:min-h-[44px] sm:h-8 sm:text-sm"
    : "h-11 text-lg max-sm:min-h-[44px] sm:h-9 sm:text-base";

  return (
    <div className="min-w-0" data-testid={testId}>
      {label ? (
        <p className={`mb-1 truncate text-center text-[#888] ${compact ? "text-[10px] sm:text-[9px]" : "text-xs sm:text-[10px]"}`}>
          {label}
        </p>
      ) : null}
      <div
        className="overflow-hidden rounded-md border border-[#373539] bg-[#141414]"
        role="group"
        aria-label={label ?? "값 선택"}
      >
        <button
          type="button"
          disabled={disabled || !canIncrease}
          onClick={onIncrease}
          aria-label={`${label ?? "값"} 올리기`}
          className={`flex ${btnH} w-full items-center justify-center border-b border-[#373539] text-[#AAA] transition-colors enabled:hover:bg-[#1f1f1f] enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <ChevronUp className={compact ? "h-4 w-4 sm:h-3.5 sm:w-3.5" : "h-4 w-4"} strokeWidth={2.5} />
        </button>
        <div
          className={`flex ${valH} items-center justify-center font-semibold tabular-nums text-white`}
          aria-live="polite"
          data-testid={testId ? `${testId}-value` : undefined}
        >
          {value}
        </div>
        <button
          type="button"
          disabled={disabled || !canDecrease}
          onClick={onDecrease}
          aria-label={`${label ?? "값"} 내리기`}
          className={`flex ${btnH} w-full items-center justify-center border-t border-[#373539] text-[#AAA] transition-colors enabled:hover:bg-[#1f1f1f] enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <ChevronDown className={compact ? "h-4 w-4 sm:h-3.5 sm:w-3.5" : "h-4 w-4"} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
