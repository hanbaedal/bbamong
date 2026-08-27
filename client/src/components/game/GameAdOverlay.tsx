import { useEffect, useRef, useState } from "react";
import { AD_EARLY_DISMISS_SECONDS } from "@shared/predictionOdds";
import { AD_PLAY_SECONDS } from "@shared/adBreakTiming";

interface GameAdOverlayProps {
  message?: string;
  /** 이 초 이후에만 X(광고 끄기) 활성. 기본 5초 */
  allowDismissAfterSeconds?: number;
  /** 지정 시 이 초까지 시청하면 onComplete */
  completeAfterSeconds?: number;
  /** 사용자가 X로 광고 끄기 — 보상 없음 (웹). 스마트폰은 보통 숨김 */
  onDismiss?: () => void;
  /** 오버레이를 끝까지 시청 — 보상 가능. 예측은 운영자가 시작 */
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
  const remainToResume =
    completeAfterSeconds == null ? null : Math.max(0, completeAfterSeconds - elapsed);

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
    if (completeAfterSeconds <= 0) {
      if (closedRef.current) return;
      closedRef.current = true;
      onCompleteRef.current?.();
      return;
    }
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
      {onDismiss && canDismiss && (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="광고 끄기"
          data-testid="button-ad-dismiss"
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-xl font-bold text-white hover:bg-white/30"
        >
          ×
        </button>
      )}
      <div className="flex flex-col items-center gap-3 px-8 text-center">
        {remainToResume != null ? (
          <>
            <p
              className="font-black tabular-nums leading-none text-[#CDFF00] drop-shadow-lg"
              style={{ fontSize: "clamp(4.5rem, 22vw, 9rem)" }}
              data-testid="text-ad-resume-countdown"
            >
              {remainToResume}
            </p>
            <p className="text-white text-lg sm:text-2xl font-bold">
              초 후 예측 화면으로 돌아갑니다
            </p>
            <p className="text-white/55 text-sm sm:text-base max-w-md">{message}</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full border-4 border-[#CDFF00]/30 border-t-[#CDFF00] animate-spin" />
            <p className="text-white text-lg sm:text-xl font-semibold">{message}</p>
          </>
        )}
        <p className="text-white/45 text-xs sm:text-sm">
          {onDismiss
            ? `리워드 동영상을 끝까지 보면 500P입니다. ${AD_PLAY_SECONDS}초 후 예측 화면으로 돌아갑니다.`
            : `${AD_PLAY_SECONDS}초가 끝나면 예측 화면으로 돌아갑니다.`}
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
