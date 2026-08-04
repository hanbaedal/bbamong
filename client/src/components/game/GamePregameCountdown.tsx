export interface PregameCountdownDisplay {
  remainingLabel: string;
  startTimeLabel: string;
}

interface GamePregameCountdownProps {
  countdown: PregameCountdownDisplay;
}

/** 경기 시작 전 — 화면 중앙 대형 카운트다운 */
export default function GamePregameCountdown({ countdown }: GamePregameCountdownProps) {
  return (
    <div
      className="absolute inset-0 z-[25] flex flex-col items-center justify-center pointer-events-none px-4"
      data-testid="game-pregame-countdown"
    >
      <p
        className="text-white/90 font-semibold tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)]"
        style={{ fontSize: "clamp(8px, 1.9vw, 13px)" }}
      >
        경기 시작까지
      </p>
      <p
        className="mt-1 sm:mt-2 font-black tabular-nums text-[#CDFF00] leading-none tracking-tight drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]"
        style={{ fontSize: "clamp(34px, 9.6vw, 84px)" }}
        data-testid="game-pregame-countdown-remaining"
      >
        {countdown.remainingLabel}
      </p>
      <p
        className="mt-2 sm:mt-3 text-white/80 font-medium drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)]"
        style={{ fontSize: "clamp(7px, 1.6vw, 11px)" }}
        data-testid="game-pregame-countdown-start"
      >
        {countdown.startTimeLabel} 개막
      </p>
    </div>
  );
}
