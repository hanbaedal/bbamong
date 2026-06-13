import React, { useState, useEffect, useRef } from "react";
import { useUserAssets } from "@/contexts/UserAssetContext";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

interface WaitingScreen {
  id: number;
  videoName: string;
  displayDuration: number;
  videoUrl: string;
}

interface LoadingOverlayProps {
  matchInfo: string;
  datetime: string;
  prediction?: string;
  predictState: "pending" | "success" | "fail";
  onClose: () => void;
  onSuccess?: () => void;

  onDonate?: () => void;
  waitingMessage?: string;
  matchId?: string;
  hasPendingPrediction?: boolean;
  isTimedOut?: boolean;
  onRetry?: () => void;
  wonAmount?: number;
  onFailAutoReturn?: () => void;
  onSuccessAutoReturn?: () => void;
}

export default function LoadingOverlay({
  matchInfo,
  datetime,
  prediction,
  predictState,
  onClose,
  onSuccess,

  onDonate,
  waitingMessage,
  matchId,
  hasPendingPrediction = false,
  isTimedOut = false,
  onRetry,
  wonAmount = 0,
  onFailAutoReturn,
  onSuccessAutoReturn,
}: LoadingOverlayProps) {
  const { assets } = useUserAssets();
  const [currentScreenIndex, setCurrentScreenIndex] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (predictState === "success" && onSuccessAutoReturn) {
      setCountdown(10);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => (prev !== null && prev > 1 ? prev - 1 : prev));
      }, 1000);
      successTimerRef.current = setTimeout(() => {
        console.log("[LoadingOverlay] 성공 화면 10초 자동 종료");
        onSuccessAutoReturn();
      }, 10000);
    }
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
        successTimerRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [predictState, onSuccessAutoReturn]);

  useEffect(() => {
    if (predictState === "fail" && onFailAutoReturn) {
      setCountdown(8);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => (prev !== null && prev > 1 ? prev - 1 : prev));
      }, 1000);
      failTimerRef.current = setTimeout(() => {
        console.log("[LoadingOverlay] 실패 화면 8초 자동 종료");
        onFailAutoReturn();
      }, 8000);
    }
    return () => {
      if (failTimerRef.current) {
        clearTimeout(failTimerRef.current);
        failTimerRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [predictState, onFailAutoReturn]);

  const { data: waitingScreens, isLoading: isLoadingScreens } = useQuery<WaitingScreen[]>({
    queryKey: ["/api/waiting-screens"],
    enabled: predictState === "pending" && !!waitingMessage,
  });

  useEffect(() => {
    if (waitingScreens && currentScreenIndex >= waitingScreens.length) {
      setCurrentScreenIndex(0);
    }
  }, [waitingScreens, currentScreenIndex]);

  useEffect(() => {
    if (!waitingScreens || waitingScreens.length === 0 || !waitingMessage || isLoadingScreens) {
      return;
    }

    const currentScreen = waitingScreens[currentScreenIndex];
    if (!currentScreen) {
      console.error("Current screen not found at index:", currentScreenIndex);
      return;
    }

    const duration = currentScreen.displayDuration * 1000;

    const timer = setTimeout(() => {
      setCurrentScreenIndex((prev) => (prev + 1) % waitingScreens.length);
    }, duration);

    return () => clearTimeout(timer);
  }, [currentScreenIndex, waitingScreens, waitingMessage, isLoadingScreens]);


  let firstText = "";
  let secondText = "";
  let stateColor = "text-white";
  let imageSrc;
  let topText: string | null = null;

  switch (predictState) {
    case "pending":
      if (isTimedOut) {
        firstText = "결과를 불러오는데 시간이 오래 걸리고 있습니다.";
        secondText = "다시 시도하거나 잠시 후 확인해주세요.";
      } else if (waitingMessage) {
        firstText = waitingMessage;
        secondText = "";
      } else if (hasPendingPrediction) {
        firstText = "진루 예측을 기다리고 있습니다.";
        secondText = "";
      } else {
        firstText = "대기 중입니다...";
        secondText = "";
      }
      stateColor = "text-white";
      imageSrc = assets.pendingGif;
      break;
    case "success":
      topText = "예측결과확인";
      firstText = `참여결과기록 : ${wonAmount}`;
      stateColor = "text-[#39FF14]";
      imageSrc = assets.successImg;
      break;
    case "fail":
      topText = "예측결과확인";
      firstText = "참여결과기록 : 0";
      stateColor = "text-[#FF0000]";
      imageSrc = assets.failImg;
      break;
  }

  if (predictState === "pending") {
    return (
      <div
        className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[68] px-5"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}
      >
        <img
          src={assets.pendingGif}
          alt="대기 중"
          className="w-[150px] h-[150px] object-contain"
          data-testid="img-waiting-screen"
        />

        <p className="text-center text-sm font-bold mb-2 text-white">
          {firstText}
        </p>
        {secondText && (
          <p className="text-center text-sm text-white">{secondText}</p>
        )}

        {isTimedOut && onRetry && (
          <button
            data-testid="button-retry-polling"
            className="mt-6 px-6 py-3 bg-[#CCF501] text-black rounded-lg font-bold text-sm hover:bg-[#D9F734] active:bg-[#B8DC01] transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
            }}
          >
            다시 시도
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[68] px-5"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}
    >
      {topText && (
        <p className={`text-center text-3xl font-bold mb-4 ${stateColor}`}>
          {topText}
        </p>
      )}

      {predictState === "success" ? (
        <img
          src={assets.successImg}
          alt="성공"
          className="w-full h-[33vh] object-contain"
          data-testid="img-success"
        />
      ) : (
        <img
          src={assets.failImg}
          alt="실패"
          className="w-full h-[33vh] object-contain"
          data-testid="img-fail"
        />
      )}

      <div className="mt-6 w-full max-w-[280px] flex flex-col items-center gap-3">
        <div className="w-full bg-[#333333] border border-[#444444] rounded-lg py-3 px-4">
          <p className={`text-center text-sm font-bold ${predictState === "fail" ? "text-[#FF0000]" : "text-[#39FF14]"}`}>
            {firstText}
          </p>
        </div>

        {predictState === "success" && onDonate ? (
          <div className="w-full flex flex-col items-center gap-2">
            <p className="text-center text-sm font-bold text-white">'세이브더칠드런'에 기부하시겠어요?</p>
            <div className="flex w-full gap-2">
              <button
                data-testid="button-donate-yes"
                className="flex-1 py-3 bg-[#CCF501] text-black rounded-lg font-bold text-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (successTimerRef.current) {
                    clearTimeout(successTimerRef.current);
                    successTimerRef.current = null;
                  }
                  if (countdownIntervalRef.current) {
                    clearInterval(countdownIntervalRef.current);
                    countdownIntervalRef.current = null;
                  }
                  onDonate();
                }}
              >
                예
              </button>
              <button
                data-testid="button-donate-no"
                className="flex-1 py-3 bg-[#333333] text-white rounded-lg font-bold text-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (successTimerRef.current) {
                    clearTimeout(successTimerRef.current);
                    successTimerRef.current = null;
                  }
                  if (countdownIntervalRef.current) {
                    clearInterval(countdownIntervalRef.current);
                    countdownIntervalRef.current = null;
                  }
                  if (onSuccessAutoReturn) onSuccessAutoReturn();
                }}
              >
                아니요
              </button>
            </div>
            <p className="text-center text-sm text-gray-400" data-testid="text-success-countdown">
              * {countdown !== null ? countdown : 10}초 후 자동으로 다음 라운드로 진행 됩니다
            </p>
          </div>
        ) : predictState === "success" && onSuccessAutoReturn ? (
          <div className="w-full flex flex-col items-center gap-2">
            <button
              data-testid="button-success-confirm"
              className="w-full py-3 bg-[#CCF501] text-black rounded-lg font-bold text-sm"
              onClick={(e) => {
                e.stopPropagation();
                if (successTimerRef.current) {
                  clearTimeout(successTimerRef.current);
                  successTimerRef.current = null;
                }
                if (countdownIntervalRef.current) {
                  clearInterval(countdownIntervalRef.current);
                  countdownIntervalRef.current = null;
                }
                onSuccessAutoReturn();
              }}
            >
              확인
            </button>
            <p className="text-center text-sm text-gray-400" data-testid="text-success-countdown">
              * {countdown !== null ? countdown : 10}초 후 자동으로 다음 라운드로 진행 됩니다
            </p>
          </div>
        ) : null}

        {predictState === "fail" && (
          <p className="mt-2 text-center text-sm text-gray-400" data-testid="text-fail-countdown">
            * {countdown !== null ? countdown : 8}초 후 자동으로 예측하기로 진행 됩니다
          </p>
        )}

        {predictState === "fail" && onFailAutoReturn && (
          <button
            data-testid="button-dismiss-result"
            className="mt-1 w-full py-3 bg-[#333333] text-white rounded-lg font-bold text-sm"
            onClick={(e) => {
              e.stopPropagation();
              if (failTimerRef.current) {
                clearTimeout(failTimerRef.current);
                failTimerRef.current = null;
              }
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
              }
              onFailAutoReturn();
            }}
          >
            닫기
          </button>
        )}

      </div>
    </div>
  );
}
