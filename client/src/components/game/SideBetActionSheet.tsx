import SideBetActionPanel from "@/components/game/SideBetActionPanel";

interface SideBetActionSheetProps {
  open: boolean;
  matchId: string;
  matchTitle: string;
  betType: "winner" | "score";
  onClose: () => void;
  onSubmitted?: () => void;
}

/** @deprecated 가로 분할 모달(TodayMatchesSideBetModal) 사용 권장 */
export default function SideBetActionSheet({
  open,
  matchId,
  matchTitle,
  betType,
  onClose,
  onSubmitted,
}: SideBetActionSheetProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3"
      onClick={onClose}
      data-testid="side-bet-action-sheet"
    >
      <div
        className="h-[min(88dvh,480px)] w-[min(420px,94vw)] overflow-hidden rounded-xl border border-[#444] bg-[#1E1E1E] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <SideBetActionPanel
          matchId={matchId}
          matchTitle={matchTitle}
          betType={betType}
          onCancel={onClose}
          onSubmitted={onSubmitted}
        />
      </div>
    </div>
  );
}
