import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { LivePitcherSummary } from "@shared/apiSportsTypes";
import { formatEra, formatStatCount, formatStatDisplay } from "@shared/batterDisplay";

interface PitcherStatsModalProps {
  open: boolean;
  pitcher: LivePitcherSummary | null;
  onClose: () => void;
}

export default function PitcherStatsModal({ open, pitcher, onClose }: PitcherStatsModalProps) {
  if (!open || !pitcher || typeof document === "undefined") return null;

  const wl =
    pitcher.wins != null || pitcher.losses != null
      ? `${formatStatCount(pitcher.wins ?? 0)}승 ${formatStatCount(pitcher.losses ?? 0)}패`
      : "—";

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[102] bg-black/65"
        onClick={onClose}
        data-testid="pitcher-stats-backdrop"
        aria-hidden
      />
      <div className="fixed inset-0 z-[103] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-[min(280px,88vw)] overflow-hidden rounded-xl border border-[#444] bg-[#1A1A1A] text-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          data-testid="pitcher-stats-modal"
        >
          <div className="flex items-center justify-between border-b border-[#333] px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] text-white/55">투수</p>
              <h3 className="truncate text-base font-bold">{pitcher.name}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-0.5 text-white/70 hover:text-white"
              aria-label="닫기"
              data-testid="pitcher-stats-close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 px-3 py-3 text-[12px]">
            <Stat label="투구" value={formatStatDisplay(pitcher.hand)} />
            <Stat label="NO" value={formatStatDisplay(pitcher.backNumber)} />
            <Stat label="승패" value={wl} />
            <Stat label="ERA" value={formatEra(pitcher.era) ?? "—"} />
          </div>
          <div className="border-t border-[#333] px-3 py-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-md bg-[#2A2A2A] py-1.5 text-sm font-semibold text-white hover:bg-[#333]"
              data-testid="pitcher-stats-close-button"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-white/55">{label}</p>
      <p className="truncate font-semibold tabular-nums">{value}</p>
    </div>
  );
}
