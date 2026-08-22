import { useEffect, useRef, useState } from "react";
import { AD_EARLY_DISMISS_SECONDS } from "@shared/predictionOdds";

interface GameAdOverlayProps {
  message?: string;
  /** 이 초 이후에만 X(광고 끄기) 활성. 기본 5초 */
  allowDismissAfterSeconds?: number;
  /** 지정 시 이 초까지 X 없이 시청하면 onComplete (웹·오버레이 폴백 보상) */
  completeAfterSeconds?: number;
  /** 사용자가 X로 광고 끄기 — 보상 없음 */
  onDismiss?: () => void;
  /** 오버레이를 끝까지 시청 — 보상 가능 */
  onComplete?: () => void;
}

export default function GameAdOverlay({
  message = "광고가 재생 중입니다...",
  allowDismissAfterSeconds = AD_EARLY_DISMISS_SECONDS,
  completeAfterSeconds,
  onDismiss,
  onComplete,
}: GameAdOverlayProps) {
  const [elapsed, setElapsed] = useState(0);
  const closedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onDismissRef = useRef(onDismiss);
  onCompleteRef.current = onComplete;
  onDismissRef.current = onDismiss;

  const canDismiss = Boolean(onDismiss) && elapsed >= allowDismissAfterSeconds;
  const secondsUntilDismiss = Math.max(0, allowDismissAfterSeconds - elapsed);

  useEffect(() => {
    closedRef.current = false;
    setElapsed(0);
    const started = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 250);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (completeAfterSeconds == null) return;
    const timer = setTimeout(() => {
      if (closedRef.current) return;
      closedRef.current = true;
      onCompleteRef.current?.();
    }, completeAfterSeconds * 1000);
    return () => clearTimeout(timer);
  }, [completeAfterSeconds]);

  const handleDismiss = () => {
    if (!canDismiss || closedRef.current) return;
    closedRef.current = true;
    onDismissRef.current?.();
  };

  return (
    <div
      className="fixed inset-0 z-[50] flex items-center justify-center bg-black/85"
      data-testid="overlay-ad-playing"
    >
      {onDismiss && (
        <button
          type="button"
          disabled={!canDismiss}
          onClick={handleDismiss}
          aria-label="광고 끄기"
          data-testid="button-ad-dismiss"
          className={`absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-xl font-bold transition-opacity ${
            canDismiss
              ? "bg-white/20 text-white hover:bg-white/30"
              : "bg-white/10 text-white/40 cursor-not-allowed"
          }`}
        >
          {canDismiss ? "×" : secondsUntilDismiss}
        </button>
      )}
      <div className="flex flex-col items-center gap-4 px-8 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-[#CDFF00]/30 border-t-[#CDFF00] animate-spin" />
        <p className="text-white text-lg sm:text-xl font-semibold">{message}</p>
        <p className="text-white/60 text-sm">
          {onDismiss
            ? "리워드 동영상을 끝까지 보면 500P입니다. 운영자가 광고를 끝낼 때 지급됩니다."
            : "리워드 광고 시청이 완료되었습니다. 잠시 후 예측이 재개됩니다."}
        </p>
        {onDismiss && !canDismiss && (
          <p className="text-white/45 text-xs" data-testid="text-ad-dismiss-countdown">
            {secondsUntilDismiss}초 후 광고 끄기 가능
          </p>
        )}
      </div>
    </div>
  );
}
