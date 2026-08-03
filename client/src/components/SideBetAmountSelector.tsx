import SpinnerField from "@/components/game/SpinnerField";
import {
  SIDE_BET_AMOUNT_OPTIONS,
  WINNER_ODDS,
  EXACT_SCORE_ODDS,
  calculateSideBetPayout,
  type SideBetAmountOption,
  type SideBetType,
} from "@shared/predictionOdds";

interface SideBetAmountSelectorProps {
  value: SideBetAmountOption;
  onChange: (amount: SideBetAmountOption) => void;
  betType: SideBetType;
  disabled?: boolean;
  compact?: boolean;
}

export default function SideBetAmountSelector({
  value,
  onChange,
  betType,
  disabled = false,
  compact = false,
}: SideBetAmountSelectorProps) {
  const odds = betType === "winner" ? WINNER_ODDS : EXACT_SCORE_ODDS;
  const payout = calculateSideBetPayout(value, betType);
  const idx = SIDE_BET_AMOUNT_OPTIONS.indexOf(value);

  const increase = () => {
    if (idx < SIDE_BET_AMOUNT_OPTIONS.length - 1) {
      onChange(SIDE_BET_AMOUNT_OPTIONS[idx + 1]!);
    }
  };

  const decrease = () => {
    if (idx > 0) {
      onChange(SIDE_BET_AMOUNT_OPTIONS[idx - 1]!);
    }
  };

  return (
    <div className={compact ? "mb-2" : "mb-3"}>
      <p className={`text-[#888] ${compact ? "mb-1.5 text-[10px]" : "mb-2 text-xs"}`}>
        배팅 P · {odds}배 · 적중 {payout}P
      </p>
      <SpinnerField
        value={`${value}P`}
        onIncrease={increase}
        onDecrease={decrease}
        canIncrease={!disabled && idx < SIDE_BET_AMOUNT_OPTIONS.length - 1}
        canDecrease={!disabled && idx > 0}
        disabled={disabled}
        compact={compact}
        testId={`side-bet-amount-${betType}`}
      />
    </div>
  );
}
