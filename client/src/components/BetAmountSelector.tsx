import { BET_AMOUNT_OPTIONS, PREDICTION_ODDS, type BetAmountOption } from "@shared/predictionOdds";

interface BetAmountSelectorProps {
  value: BetAmountOption;
  onChange: (amount: BetAmountOption) => void;
  selectedPrediction?: string | null;
  disabled?: boolean;
}

export default function BetAmountSelector({
  value,
  onChange,
  selectedPrediction,
  disabled = false,
}: BetAmountSelectorProps) {
  const odds =
    selectedPrediction && selectedPrediction in PREDICTION_ODDS
      ? PREDICTION_ODDS[selectedPrediction as keyof typeof PREDICTION_ODDS]
      : null;

  return (
    <div className="mb-4">
      <h2 className="text-white text-base font-bold mb-2">배팅 포인트</h2>
      <div className="grid grid-cols-5 gap-2">
        {BET_AMOUNT_OPTIONS.map((amount) => (
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
      {odds !== null && (
        <p className="mt-2 text-xs text-[#AAAAAA]">
          적중 시 예상 지급: {Math.floor(value * odds)}P (배당 {odds}배)
        </p>
      )}
    </div>
  );
}
