import SpinnerField from "@/components/game/SpinnerField";

/** 야구 최종 스코어 예측 — 서버 검증과 동일 */
export const SIDE_BET_MAX_SCORE = 30;
export const SIDE_BET_MIN_SCORE = 0;

interface ScorePickerProps {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
  testId?: string;
  compact?: boolean;
  /** vertical: ▲▼ / horizontal: − 숫자 + */
  layout?: "vertical" | "horizontal";
}

/** 점수 증감 선택 */
export default function ScorePicker({
  label,
  value,
  onChange,
  disabled = false,
  testId,
  compact = false,
  layout = "vertical",
}: ScorePickerProps) {
  const canIncrease =
    !disabled && (value == null || value < SIDE_BET_MAX_SCORE);
  const canDecrease =
    !disabled && value != null && value > SIDE_BET_MIN_SCORE;

  const increase = () => {
    if (value == null) {
      onChange(SIDE_BET_MIN_SCORE);
      return;
    }
    if (value < SIDE_BET_MAX_SCORE) onChange(value + 1);
  };

  const decrease = () => {
    if (value != null && value > SIDE_BET_MIN_SCORE) onChange(value - 1);
  };

  return (
    <SpinnerField
      label={label}
      value={value == null ? "−" : String(value)}
      onIncrease={increase}
      onDecrease={decrease}
      canIncrease={canIncrease}
      canDecrease={canDecrease}
      disabled={disabled}
      testId={testId}
      compact={compact}
      layout={layout}
    />
  );
}
