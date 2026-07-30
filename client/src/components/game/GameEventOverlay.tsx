import type { RoundAdvanceType } from "./gameTypes";

interface GameEventOverlayProps {
  type: Extract<RoundAdvanceType, "pitcher_change" | "switch_half">;
  subtitle?: string;
  countdown?: number | null;
}

export default function GameEventOverlay({ type, subtitle, countdown }: GameEventOverlayProps) {
  const isPitcherChange = type === "pitcher_change";

  return (
    <div
      className="absolute inset-0 z-[40] pointer-events-none flex items-center justify-center"
      data-testid={isPitcherChange ? "overlay-pitcher-change" : "overlay-inning-switch"}
    >
      <div className="absolute inset-0 bg-black/55 animate-game-event-backdrop" />

      <div className="relative flex flex-col items-center gap-3 sm:gap-4 px-6 animate-game-event-pop">
        {isPitcherChange ? (
          <>
            <div className="relative w-[min(28vw,200px)] h-[min(28vw,200px)] flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-[#CDFF00]/40 animate-pitcher-ring" />
              <div className="absolute inset-[12%] rounded-full border-2 border-dashed border-white/30 animate-pitcher-spin" />
              <span className="text-5xl sm:text-6xl animate-pitcher-swap" aria-hidden>
                ⚾
              </span>
              <span
                className="absolute -right-2 top-0 text-2xl sm:text-3xl animate-pitcher-arrow"
                aria-hidden
              >
                ↔
              </span>
            </div>
            <p className="text-[#CDFF00] text-2xl sm:text-4xl font-black tracking-tight drop-shadow-lg">
              투수 교체!
            </p>
            <p className="text-white/85 text-sm sm:text-base text-center max-w-[80vw]">
              새로운 투수가 마운드에 올라섭니다
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center gap-1 animate-inning-arrows">
              <span className="text-3xl sm:text-4xl text-[#CDFF00]" aria-hidden>
                ▲
              </span>
              <span className="text-4xl sm:text-5xl text-white font-black px-4" aria-hidden>
                ⇅
              </span>
              <span className="text-3xl sm:text-4xl text-[#CDFF00]" aria-hidden>
                ▼
              </span>
            </div>
            <p className="text-[#CDFF00] text-2xl sm:text-4xl font-black tracking-tight drop-shadow-lg">
              공수 교대!
            </p>
            {subtitle && (
              <p className="text-white text-base sm:text-xl font-semibold text-center max-w-[85vw]">
                {subtitle}
              </p>
            )}
          </>
        )}

        {countdown != null && countdown > 0 && (
          <p className="text-white/60 text-xs sm:text-sm mt-1">{countdown}초 후 대기 화면</p>
        )}
      </div>
    </div>
  );
}
