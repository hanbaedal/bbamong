import { useEffect, useState } from "react";
import {
  GAME_DAY_END_REDIRECT_MS,
  GAME_NO_MATCH_DISPLAY,
  GAME_TERMINAL_DISPLAY,
  type GameDayOverlayKind,
} from "@/lib/gameDayPhase";

interface GameDayStatusOverlayProps {
  kind: GameDayOverlayKind;
  onComplete: () => void;
  /** 예: "방으로" — 기본 "홈으로" */
  redirectLabel?: string;
}

/** 종료·취소·연기·미등록 — 경기 전 카운트다운과 같은 대형 중앙 안내 */
export default function GameDayStatusOverlay({
  kind,
  onComplete,
  redirectLabel = "홈으로",
}: GameDayStatusOverlayProps) {
  const display =
    kind === "no_match" ? GAME_NO_MATCH_DISPLAY : GAME_TERMINAL_DISPLAY[kind];
  const totalSeconds = Math.ceil(GAME_DAY_END_REDIRECT_MS / 1000);
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);

  useEffect(() => {
    const timer = window.setTimeout(onComplete, GAME_DAY_END_REDIRECT_MS);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  useEffect(() => {
    setSecondsLeft(totalSeconds);
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [kind, totalSeconds]);

  return (
    <div
      className="absolute inset-0 z-[25] flex flex-col items-center justify-center pointer-events-none px-4"
      data-testid="game-day-status-overlay"
      data-terminal-kind={kind}
      role="status"
      aria-live="polite"
    >
      <p
        className="text-white/90 font-semibold tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)]"
        style={{ fontSize: "clamp(8px, 1.9vw, 13px)" }}
      >
        오늘의 경기
      </p>
      <p
        className="mt-1 sm:mt-2 font-black leading-none tracking-tight drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]"
        style={{
          fontSize: "clamp(34px, 9.6vw, 84px)",
          color: display.mainColor,
        }}
        data-testid="game-day-status-main"
      >
        {display.mainLabel}
      </p>
      <p
        className="mt-1 sm:mt-2 text-white/85 font-semibold drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)]"
        style={{ fontSize: "clamp(10px, 2.4vw, 16px)" }}
      >
        {display.subtitle}
      </p>
      <p
        className="mt-2 sm:mt-3 text-white/75 font-medium drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)]"
        style={{ fontSize: "clamp(7px, 1.6vw, 11px)" }}
        data-testid="game-day-status-redirect"
      >
        {secondsLeft > 0 ? `${secondsLeft}초 후 ${redirectLabel}` : `${redirectLabel} 이동 중…`}
      </p>
    </div>
  );
}
