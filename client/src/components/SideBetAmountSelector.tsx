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
}

export default function SideBetAmountSelector({
  value,
  onChange,
  betType,
  disabled = false,
}: SideBetAmountSelectorProps) {
  const odds = betType === "winner" ? WINNER_ODDS : EXACT_SCORE_ODDS;
  const payout = calculateSideBetPayout(value, betType);

  return (
    <div className="mb-3">
      <p className="text-[#888] text-xs mb-2">
        배팅 포인트 (100P 단위) · {odds}배 · 적중 시 {payout}P
      </p>
      <div className="grid grid-cols-4 gap-2">
        {SIDE_BET_AMOUNT_OPTIONS.map((amount) => (
          <button
            key={amount}
            type="button"
            disabled={disabled}
            onClick={() => onChange(amount)}
            className={`rounded-lg border px-2 py-2 text-sm font-semibold transition-colors ${
              value === amount
                ? "border-[#CDFF00] bg-[#CDFF00] text-black"
                : "border-[#373539] bg-[#1A1A1A] text-white hover:border-[#6B6B6B]"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {amount}
          </button>
        ))}
      </div>
    </div>
  );
}
