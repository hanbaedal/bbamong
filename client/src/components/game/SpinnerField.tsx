import { ChevronDown, ChevronUp } from "lucide-react";

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
}

/** ▲▼ 증감 + 중앙 표시 (점수·포인트 공용) */
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
}: SpinnerFieldProps) {
  const btnH = compact ? "h-6" : "h-7";
  const valH = compact ? "h-8 text-sm" : "h-9 text-base";

  return (
    <div className="min-w-0" data-testid={testId}>
      {label ? (
        <p className={`mb-1 truncate text-center text-[#888] ${compact ? "text-[9px]" : "text-[10px]"}`}>
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
          <ChevronUp className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2.5} />
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
          <ChevronDown className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
