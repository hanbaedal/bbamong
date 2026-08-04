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

/** 배팅 P — 3열×2행 칩 선택 */
export default function SideBetAmountSelector({
  value,
  onChange,
  betType,
  disabled = false,
  compact = false,
}: SideBetAmountSelectorProps) {
  const odds = betType === "winner" ? WINNER_ODDS : EXACT_SCORE_ODDS;
  const payout = calculateSideBetPayout(value, betType);

  return (
    <div className={compact ? "mb-1.5" : "mb-3"} data-testid={`side-bet-amount-${betType}`}>
      <p className={`text-[#888] ${compact ? "mb-1 text-[10px]" : "mb-2 text-xs"}`}>
        배팅 P · {odds}배 · 적중 {payout}P
      </p>
      <div className="grid grid-cols-3 gap-1">
        {SIDE_BET_AMOUNT_OPTIONS.map((amount) => {
          const selected = value === amount;
          return (
            <button
              key={amount}
              type="button"
              disabled={disabled}
              onClick={() => onChange(amount)}
              className={`rounded-md border font-semibold tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                compact
                  ? "h-7 text-[10px] sm:h-6 sm:text-[9px]"
                  : "h-9 text-xs"
              } ${
                selected
                  ? "border-[#CDFF00] bg-[#CDFF00]/10 text-[#CDFF00]"
                  : "border-[#373539] text-white enabled:hover:border-[#666]"
              }`}
              data-testid={`side-bet-amount-${betType}-${amount}`}
              aria-pressed={selected}
            >
              {amount}P
            </button>
          );
        })}
      </div>
    </div>
  );
}
