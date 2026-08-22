import BetAmountSelector from "@/components/BetAmountSelector";
import { calculateFixedOddsPayout, type BetAmountOption } from "@shared/predictionOdds";
import type { PredictionOption } from "./gameTypes";

interface GameBetModalProps {
  open: boolean;
  prediction: PredictionOption;
  betAmount: BetAmountOption;
  onBetAmountChange: (amount: BetAmountOption) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export default function GameBetModal({
  open,
  prediction,
  betAmount,
  onBetAmountChange,
  onCancel,
  onSubmit,
}: GameBetModalProps) {
  if (!open) return null;

  const payout = calculateFixedOddsPayout(betAmount, prediction);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55" onClick={onCancel}>
      <div
        className="w-[min(420px,88vw)] bg-[#1E1E1E] border border-[#444] rounded-xl shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
        data-testid="game-bet-modal"
      >
        <h3 className="text-white text-lg font-bold text-center mb-1">배팅 포인트 선택</h3>
        <p className="text-[#CDFF00] text-center text-sm mb-4">예측: {prediction}</p>
        <BetAmountSelector
          value={betAmount}
          onChange={onBetAmountChange}
          selectedPrediction={prediction}
        />
        <p className="text-xs text-[#AAA] text-center mb-4">
          적중 시 예상 지급 <span className="text-[#CDFF00] font-bold">{payout}P</span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-11 rounded-lg bg-[#474747] text-white font-medium"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="flex-1 h-11 rounded-lg bg-[#CCF501] text-black font-bold"
            data-testid="button-bet-submit"
          >
            예측하기
          </button>
        </div>
      </div>
    </div>
  );
}
