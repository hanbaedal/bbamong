import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { TeamSeasonStats } from "@shared/apiSportsTypes";
import { kboTeamPrimaryColor } from "@shared/kboTeamColors";

function dash(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return String(value);
}

interface TeamSeasonStatsModalProps {
  open: boolean;
  teamName: string;
  stats: TeamSeasonStats | null;
  onClose: () => void;
}

export default function TeamSeasonStatsModal({
  open,
  teamName,
  stats,
  onClose,
}: TeamSeasonStatsModalProps) {
  if (!open || typeof document === "undefined") return null;

  const season = stats?.season ?? new Date().getFullYear();
  const accent = kboTeamPrimaryColor(stats?.teamShort || teamName);

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[102] bg-black/65"
        onClick={onClose}
        data-testid="team-season-stats-backdrop"
        aria-hidden
      />
      <div className="fixed inset-0 z-[103] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-[min(420px,94vw)] overflow-hidden rounded-xl border border-[#444] bg-[#1A1A1A] text-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          data-testid="team-season-stats-modal"
        >
          <div className="flex items-center justify-between border-b border-[#333] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[11px] text-white/60">{season} 시즌</p>
              <h3 className="truncate text-base font-bold" style={{ color: accent }}>
                {teamName}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-0.5 text-white/70 hover:text-white"
              aria-label="닫기"
              data-testid="team-season-stats-close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-x-2 gap-y-2 px-3 py-3 text-[12px] sm:text-sm">
            <Stat label="순위" value={dash(stats?.rank)} />
            <Stat label="승" value={dash(stats?.wins)} />
            <Stat label="무" value={dash(stats?.draws)} />
            <Stat label="패" value={dash(stats?.losses)} />
            <Stat label="승률" value={dash(stats?.winningPercentage)} />
            <Stat label="타율" value={dash(stats?.battingAverage)} />
            <Stat label="평균자책" value={dash(stats?.era)} />
            <Stat label="승차" value={dash(stats?.gamesBehind)} />
          </div>
          <div className="border-t border-[#333] px-3 py-2.5">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-md bg-[#2A2A2A] py-2 text-sm font-semibold text-white hover:bg-[#333]"
              data-testid="team-season-stats-close-button"
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
