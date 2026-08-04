import React, { useState, useEffect, useRef } from "react";
import { useUserAssets } from "@/contexts/UserAssetContext";
import { useQuery } from "@tanstack/react-query";
import LineScoreTable from "@/components/LineScoreTable";
import type { LiveScoreboard } from "@shared/apiSportsTypes";
import { getScoreboardDisplayTeamLabels } from "@shared/matchTeamDisplay";

interface WaitingScreen {
  id: number;
  videoName: string;
  displayDuration: number;
  videoUrl: string;
}

/** 다음 타자 예측 대기 화면 상단 정보 */
export interface GamePhaseDisplay {
  matchTitle: string;
  inningText: string;
  batterText: string;
}

/** pending 대기 화면 종류 */
export type PendingWaitingMode = "next_batter" | "result";

interface LoadingOverlayProps {
  matchInfo: string;
  datetime: string;
  prediction?: string;
  predictState: "pending" | "success" | "fail";
  onClose: () => void;
  onSuccess?: () => void;

  onDonate?: () => void;
  waitingMessage?: string;
  /** next_batter=스코어표 O, result=스코어표 X + 예측 정보 */
  pendingWaitingMode?: PendingWaitingMode;
  betAmount?: number;
  gamePhaseDisplay?: GamePhaseDisplay;
  liveScoreboard?: LiveScoreboard | null;
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
  pendingWaitingMode,
  betAmount,
  gamePhaseDisplay,
  liveScoreboard,
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
      imageSrc = assets.userMascot;
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
    const useWaitingGameLayout = Boolean(
      gamePhaseDisplay &&
        !isTimedOut &&
        (pendingWaitingMode === "next_batter" || pendingWaitingMode === "result"),
    );

    if (useWaitingGameLayout && gamePhaseDisplay) {
      const awayScore = liveScoreboard?.awayScore ?? 0;
      const homeScore = liveScoreboard?.homeScore ?? 0;
      const { awayLabel, homeLabel } = getScoreboardDisplayTeamLabels(liveScoreboard, {
        awayFallback: "원정팀",
        homeFallback: "홈팀",
      });
      const isResultWait = pendingWaitingMode === "result";
      const statusMessage =
        waitingMessage ??
        (isResultWait ? "예측 결과를 기다리는 중입니다." : "다음타자 예측을 기다리는 중입니다.");

      return (
        <div
          className="fixed inset-0 bg-white flex flex-col z-[68]"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)" }}
          data-testid={isResultWait ? "waiting-result-screen" : "waiting-prediction-screen"}
        >
          <div className="flex-shrink-0 pt-10 px-5 text-center">
            <p
              className="text-[28px] sm:text-[32px] font-bold text-[#1F9E1F] leading-tight"
              data-testid="text-game-phase-title"
            >
              {gamePhaseDisplay.matchTitle}
            </p>
            <p className="mt-5 text-base sm:text-lg text-black" data-testid="text-game-inning">
              {gamePhaseDisplay.inningText}
            </p>
            <p className="mt-2 text-base sm:text-lg text-black" data-testid="text-game-score">
              {awayLabel} {awayScore} - {homeScore} {homeLabel}
            </p>

            {isResultWait ? (
              <>
                <p
                  className="mt-8 text-lg sm:text-xl font-bold text-black"
                  data-testid="text-game-batter"
                >
                  {gamePhaseDisplay.batterText}
                </p>
                <p
                  className="mt-4 text-lg sm:text-xl font-bold text-black"
                  data-testid="text-waiting-status"
                >
                  {statusMessage}
                </p>
                <div
                  className="mt-6 mx-auto max-w-[280px] rounded-lg border border-[#CCCCCC] bg-[#F8F8F8] px-4 py-3 text-left"
                  data-testid="submitted-prediction-summary"
                >
                  <p className="text-sm text-black">
                    <span className="text-[#666666]">포인트</span>{" "}
                    <span className="font-bold">{betAmount ?? 0}P</span>
                  </p>
                  <p className="mt-2 text-sm text-black">
                    <span className="text-[#666666]">예측</span>{" "}
                    <span className="font-bold">{prediction ?? "—"}</span>
                  </p>
                </div>
              </>
            ) : (
              <>
                <p
                  className="mt-8 text-lg sm:text-xl font-bold text-black"
                  data-testid="text-game-batter"
                >
                  {gamePhaseDisplay.batterText}
                </p>
                <p className="mt-4 text-lg sm:text-xl font-bold text-black" data-testid="text-waiting-status">
                  {statusMessage}
                </p>
              </>
            )}
          </div>

          <div className="flex-1 flex items-center justify-center min-h-[120px] px-5">
            <img
              src={assets.userMascot}
              alt="빠몽이"
              className="w-[min(220px,55vw)] h-auto object-contain"
              data-testid="img-waiting-screen"
            />
          </div>

          {!isResultWait && (
            <div className="flex-shrink-0 px-4 pb-2" data-testid="waiting-line-score">
              <LineScoreTable scoreboard={liveScoreboard} fixedInningColumns />
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[68] px-5"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}
      >
        <div className="text-center mb-8 px-4 w-full" data-testid="text-waiting-status">
          <p className="text-lg sm:text-xl font-bold text-white leading-snug">
            {firstText}
          </p>
          {secondText && (
            <p className="mt-2 text-base sm:text-lg text-white/90 leading-snug">{secondText}</p>
          )}
        </div>

        <img
          src={assets.userMascot}
          alt="빠몽이"
          className="w-[180px] h-[180px] object-contain"
          data-testid="img-waiting-screen"
        />

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
