import { useEffect } from "react";
import pyamongSuccess from "@assets/game/pyamong-success.png";
import GameConfetti from "./GameConfetti";
import { playSideBetFanfare, stopSideBetFanfare } from "@/lib/sideBetFanfare";
import { formatSideBetStatus } from "@/lib/sideBetMatchUtils";

export interface SideBetResultLine {
  type: "winner" | "score";
  label: string;
  status: "won" | "lost" | "refunded" | string;
  wonAmount?: number;
}

interface SideBetResultOverlayProps {
  open: boolean;
  lines: SideBetResultLine[];
  matchTitle?: string;
  onClose: () => void;
  autoCloseMs?: number;
}

export default function SideBetResultOverlay({
  open,
  lines,
  matchTitle,
  onClose,
  autoCloseMs = 3200,
}: SideBetResultOverlayProps) {
  const anyWon = lines.some((l) => l.status === "won");

  useEffect(() => {
    if (!open) return;
    if (anyWon) {
      void playSideBetFanfare();
    }
    const timer = window.setTimeout(() => {
      onClose();
    }, autoCloseMs);
    return () => {
      window.clearTimeout(timer);
      stopSideBetFanfare();
    };
  }, [open, anyWon, autoCloseMs, onClose]);

  if (!open || lines.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      data-testid="side-bet-result-overlay"
    >
      {anyWon ? <GameConfetti active count={56} playSound={false} /> : null}

      <div
        className={`relative z-[1] w-[min(360px,92vw)] rounded-2xl border px-5 pt-5 pb-4 shadow-2xl text-center ${
          anyWon
            ? "bg-[#142014]/95 border-[#39FF14]/70"
            : "bg-[#1E1E1E]/95 border-[#555]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {anyWon ? (
          <img
            src={pyamongSuccess}
            alt=""
            className="mx-auto mb-3 w-[min(28vw,140px)] h-auto drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)]"
            data-testid="side-bet-result-mascot"
          />
        ) : null}

        <p
          className={`text-lg sm:text-xl font-bold ${
            anyWon ? "text-[#CDFF00]" : "text-white"
          }`}
          data-testid="side-bet-result-title"
        >
          {anyWon ? "사이드 예측 성공!" : "사이드 예측 결과"}
        </p>
        {matchTitle ? (
          <p className="mt-1 text-xs text-white/70">{matchTitle}</p>
        ) : null}

        <ul className="mt-3 space-y-1.5 text-sm" data-testid="side-bet-result-lines">
          {lines.map((line) => {
            const statusText = formatSideBetStatus(line.status);
            const isWon = line.status === "won";
            return (
              <li
                key={line.type}
                className={`rounded-lg px-3 py-2 ${
                  isWon ? "bg-[#CDFF00]/12 text-[#CDFF00]" : "bg-white/5 text-white/85"
                }`}
              >
                <span className="font-semibold">
                  {line.type === "winner" ? "우승팀" : "점수"}
                </span>
                {" · "}
                {line.label}
                {" · "}
                <span className={isWon ? "font-bold" : ""}>{statusText}</span>
                {isWon && (line.wonAmount ?? 0) > 0 ? (
                  <span className="font-bold"> (+{line.wonAmount}P)</span>
                ) : null}
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={onClose}
          className={`mt-4 w-full h-11 rounded-lg font-bold ${
            anyWon ? "bg-[#CDFF00] text-black" : "bg-[#474747] text-white"
          }`}
          data-testid="side-bet-result-close"
        >
          확인
        </button>
      </div>
    </div>
  );
}
