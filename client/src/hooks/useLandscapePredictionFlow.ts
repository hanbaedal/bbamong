import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMatchWebSocket, type WSEventHandlers } from "@/hooks/useMatchWebSocket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useUser } from "@/contexts/UserContext";
import { shouldClientPollMatch } from "@/lib/matchPollWindow";
import {
  DEFAULT_BET_AMOUNT,
  calculateFixedOddsPayout,
  type BetAmountOption,
} from "@shared/predictionOdds";
import type { GameScreenPhase, PredictionOption, PredictionResult } from "@/components/game/gameTypes";

import type { LiveScoreboard } from "@shared/apiSportsTypes";

export interface MatchFlowData {
  id: string;
  name: string;
  stadiumName: string;
  startTime: string;
  matchStatus: string;
  predictionEnabled?: boolean;
}

interface ActiveBet {
  round: number;
  prediction: PredictionOption;
  predictionId: number;
  amount: number;
}

/** 성공·실패 결과 배너 자동 종료 (동일 시간 — 메시지 인지에 충분하고 반복 플레이 시 지루함 적음) */
const RESULT_AUTO_MS = 5000;

export function useLandscapePredictionFlow(
  selectedMatch: MatchFlowData | null,
  options?: {
    onScoreboardUpdate?: (scoreboard: LiveScoreboard) => void;
    onGamePhaseUpdate?: (phase: unknown) => void;
  },
) {
  const { user, setUser } = useUser();
  const { toast } = useToast();
  const onScoreboardRef = useRef(options?.onScoreboardUpdate);
  const onGamePhaseRef = useRef(options?.onGamePhaseUpdate);
  onScoreboardRef.current = options?.onScoreboardUpdate;
  onGamePhaseRef.current = options?.onGamePhaseUpdate;

  const [screenPhase, setScreenPhase] = useState<GameScreenPhase>("wait_start");
  const [predictionEnabled, setPredictionEnabled] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionOption | null>(null);
  const [selectedBetAmount, setSelectedBetAmount] = useState<BetAmountOption>(DEFAULT_BET_AMOUNT);
  const [showBetModal, setShowBetModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [predictionResult, setPredictionResult] = useState<PredictionResult>("pending");
  const [lastWonAmount, setLastWonAmount] = useState(0);
  const [lastBetAmount, setLastBetAmount] = useState(0);
  const [resultCountdown, setResultCountdown] = useState<number | null>(null);

  const activeBetRef = useRef<ActiveBet | null>(null);
  const waitingResultRef = useRef(false);
  const resultShownRef = useRef(false);
  const lastResultPredictionIdRef = useRef<number | null>(null);
  const acknowledgedResultIdRef = useRef<number | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const predictionEnabledRef = useRef(false);

  useEffect(() => {
    predictionEnabledRef.current = predictionEnabled;
  }, [predictionEnabled]);

  const clearResultTimers = useCallback(() => {
    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setResultCountdown(null);
  }, []);

  const resetToWaitStart = useCallback(() => {
    clearResultTimers();
    resultShownRef.current = false;
    waitingResultRef.current = false;
    activeBetRef.current = null;
    setSelectedPrediction(null);
    setPredictionResult("pending");
    setShowBetModal(false);
    setShowConfirmModal(false);
    setLastWonAmount(0);
    setLastBetAmount(0);
    setScreenPhase("wait_start");
  }, [clearResultTimers]);

  const applyCheckResponse = useCallback(
    (data: {
      hasPrediction: boolean;
      prediction?: string;
      predictionId?: number;
      roundNumber?: number;
      amount?: number;
      status?: string;
      wonAmount?: number;
      predictionEnabled?: boolean;
    }) => {
      const enabled = Boolean(data.predictionEnabled);
      setPredictionEnabled(enabled);

      if (data.hasPrediction) {
        const resolvedId = data.predictionId ?? null;
        const isResolved = data.status === "success" || data.status === "fail";

        if (
          isResolved &&
          resolvedId != null &&
          resolvedId === acknowledgedResultIdRef.current
        ) {
          activeBetRef.current = null;
          waitingResultRef.current = false;
          resultShownRef.current = false;
          setSelectedPrediction(null);
          setPredictionResult("pending");
          setLastWonAmount(0);
          setLastBetAmount(0);
          setScreenPhase(enabled ? "picking" : "wait_start");
          return;
        }

        waitingResultRef.current = true;
        setSelectedPrediction((data.prediction as PredictionOption) ?? null);
        setLastBetAmount(data.amount ?? DEFAULT_BET_AMOUNT);

        if (isResolved) {
          if (resolvedId != null) lastResultPredictionIdRef.current = resolvedId;
          resultShownRef.current = true;
          setPredictionResult(data.status as PredictionResult);
          setLastWonAmount(data.wonAmount ?? 0);
          setScreenPhase(data.status === "success" ? "success_celebrate" : "fail");
          activeBetRef.current = null;
        } else {
          if (resolvedId != null) lastResultPredictionIdRef.current = resolvedId;
          activeBetRef.current = {
            round: data.roundNumber ?? 0,
            prediction: data.prediction as PredictionOption,
            predictionId: resolvedId ?? 0,
            amount: data.amount ?? DEFAULT_BET_AMOUNT,
          };
          setScreenPhase("wait_result");
        }
        return;
      }

      activeBetRef.current = null;
      waitingResultRef.current = false;
      if (enabled) {
        setScreenPhase("picking");
      } else {
        setScreenPhase("wait_start");
      }
    },
    [],
  );

  const checkPredictionStatus = useCallback(async () => {
    if (!selectedMatch?.id) return;
    try {
      const res = await apiRequest("GET", `/api/live-match/predictions/${selectedMatch.id}/check`);
      if (!res.ok) return;
      const data = await res.json();
      applyCheckResponse(data);
    } catch {
      /* ignore */
    }
  }, [selectedMatch?.id, applyCheckResponse]);

  useEffect(() => {
    if (!selectedMatch?.id) return;
    acknowledgedResultIdRef.current = null;
    lastResultPredictionIdRef.current = null;
    resultDismissScheduledRef.current = false;
    void checkPredictionStatus();
  }, [selectedMatch?.id, checkPredictionStatus]);

  useEffect(() => {
    if (!selectedMatch?.id) return;
    if (!shouldClientPollMatch(selectedMatch.startTime, selectedMatch.matchStatus)) return;

    const poll = async () => {
      if (resultShownRef.current) return;
      try {
        const res = await apiRequest("GET", `/api/matches/${selectedMatch.id}`);
        if (!res.ok) return;
        const matchData = await res.json();
        setPredictionEnabled(Boolean(matchData.predictionEnabled));

        if (screenPhase === "wait_start" && matchData.predictionEnabled && !waitingResultRef.current) {
          setScreenPhase("picking");
        }
      } catch {
        /* ignore */
      }
    };

    void poll();
    const id = setInterval(poll, 2500);
    return () => clearInterval(id);
  }, [selectedMatch?.id, selectedMatch?.startTime, selectedMatch?.matchStatus, screenPhase]);

  useEffect(() => {
    if (screenPhase !== "wait_result" || predictionResult !== "pending" || !selectedMatch?.id) return;

    const id = setInterval(() => {
      void (async () => {
        try {
          const res = await apiRequest("GET", `/api/live-match/predictions/${selectedMatch.id}/check`);
          if (!res.ok) return;
          const data = await res.json();
          if (data.status === "success" || data.status === "fail") {
            if (
              data.predictionId != null &&
              data.predictionId === acknowledgedResultIdRef.current
            ) {
              return;
            }
            if (data.predictionId != null) lastResultPredictionIdRef.current = data.predictionId;
            resultShownRef.current = true;
            waitingResultRef.current = false;
            setPredictionResult(data.status);
            setLastWonAmount(data.wonAmount ?? 0);
            setLastBetAmount(data.amount ?? activeBetRef.current?.amount ?? DEFAULT_BET_AMOUNT);
            activeBetRef.current = null;
            if (user && data.status === "success" && data.wonAmount > 0) {
              setUser({ ...user, points: (user.points ?? 0) + data.wonAmount });
            }
            setScreenPhase(data.status === "success" ? "success_running" : "fail");
          }
        } catch {
          /* ignore */
        }
      })();
    }, 2000);

    return () => clearInterval(id);
  }, [screenPhase, predictionResult, selectedMatch?.id, user, setUser]);

  const resultDismissScheduledRef = useRef(false);

  const scheduleResultDismiss = useCallback(
    (ms: number) => {
      clearResultTimers();
      const sec = Math.ceil(ms / 1000);
      setResultCountdown(sec);
      countdownIntervalRef.current = setInterval(() => {
        setResultCountdown((prev) => (prev != null && prev > 1 ? prev - 1 : prev));
      }, 1000);
      resultTimerRef.current = setTimeout(() => {
        resultDismissScheduledRef.current = false;
        if (lastResultPredictionIdRef.current != null) {
          acknowledgedResultIdRef.current = lastResultPredictionIdRef.current;
        }
        clearResultTimers();
        resultShownRef.current = false;
        waitingResultRef.current = false;
        activeBetRef.current = null;
        setSelectedPrediction(null);
        setPredictionResult("pending");
        setShowBetModal(false);
        setShowConfirmModal(false);
        setLastWonAmount(0);
        setLastBetAmount(0);
        setScreenPhase(predictionEnabledRef.current ? "picking" : "wait_start");
      }, ms);
    },
    [clearResultTimers],
  );

  const handleRunComplete = useCallback(() => {
    setScreenPhase("success_celebrate");
  }, []);

  useEffect(() => {
    if (screenPhase !== "success_celebrate" && screenPhase !== "fail") {
      resultDismissScheduledRef.current = false;
      return;
    }
    if (resultDismissScheduledRef.current) return;
    resultDismissScheduledRef.current = true;
    scheduleResultDismiss(RESULT_AUTO_MS);
  }, [screenPhase, scheduleResultDismiss]);

  const handleRoundResult = useCallback(
    (data: { result?: string; wonAmount?: number }) => {
      if (resultShownRef.current) return;
      const bet = activeBetRef.current;
      if (!bet) return;

      const isSuccess = data.result === bet.prediction;
      if (bet.predictionId) lastResultPredictionIdRef.current = bet.predictionId;
      resultShownRef.current = true;
      waitingResultRef.current = false;
      setPredictionResult(isSuccess ? "success" : "fail");
      setLastWonAmount(data.wonAmount ?? 0);
      setLastBetAmount(bet.amount);
      setSelectedPrediction(bet.prediction);
      activeBetRef.current = null;

      if (isSuccess && user) {
        const won = data.wonAmount ?? calculateFixedOddsPayout(bet.amount, bet.prediction);
        setLastWonAmount(won);
        if (won > 0) setUser({ ...user, points: (user.points ?? 0) + won });
        setScreenPhase("success_running");
      } else {
        setScreenPhase("fail");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    },
    [user, setUser],
  );

  const wsHandlers: WSEventHandlers = {
    onConnected: useCallback((data: { predictionEnabled?: boolean }) => {
      if (data.predictionEnabled !== undefined) {
        setPredictionEnabled(data.predictionEnabled);
        if (resultShownRef.current || waitingResultRef.current) return;
        setScreenPhase(data.predictionEnabled ? "picking" : "wait_start");
      }
    }, []),

    onPredictionStarted: useCallback(() => {
      if (waitingResultRef.current || activeBetRef.current) {
        setScreenPhase("wait_result");
        return;
      }
      resultShownRef.current = false;
      setPredictionEnabled(true);
      setSelectedPrediction(null);
      setScreenPhase("picking");
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    }, []),

    onPredictionEnded: useCallback(() => {
      setPredictionEnabled(false);
      setShowBetModal(false);
      setShowConfirmModal(false);
      if (waitingResultRef.current || activeBetRef.current) {
        setScreenPhase("wait_result");
        return;
      }
      // 예측 미제출: 다음 타자/교체/공수교대 대기(빠몽이) — 별도 팝업 없음
      setSelectedPrediction(null);
      setScreenPhase("wait_start");
    }, []),

    onUserAlreadyPredicted: useCallback((data: {
      prediction: string;
      predictionId?: number;
      round?: number;
      amount?: number;
      status?: string;
      wonAmount?: number;
    }) => {
      waitingResultRef.current = true;
      setSelectedPrediction(data.prediction as PredictionOption);
      setLastBetAmount(data.amount ?? DEFAULT_BET_AMOUNT);

      if (data.status === "success" || data.status === "fail") {
        if (data.predictionId != null) lastResultPredictionIdRef.current = data.predictionId;
        if (
          data.predictionId != null &&
          data.predictionId === acknowledgedResultIdRef.current
        ) {
          return;
        }
        resultShownRef.current = true;
        setPredictionResult(data.status);
        setLastWonAmount(data.wonAmount ?? 0);
        setScreenPhase(data.status === "success" ? "success_celebrate" : "fail");
        return;
      }

      activeBetRef.current = {
        round: data.round ?? 0,
        prediction: data.prediction as PredictionOption,
        predictionId: data.predictionId ?? 0,
        amount: data.amount ?? DEFAULT_BET_AMOUNT,
      };
      setScreenPhase("wait_result");
    }, []),

    onRoundResult: useCallback((data: { result?: string; wonAmount?: number }) => {
      handleRoundResult(data);
    }, [handleRoundResult]),

    onRoundNext: useCallback((data: { predictionEnabled?: boolean; gamePhase?: unknown }) => {
      if (data.gamePhase) onGamePhaseRef.current?.(data.gamePhase);
      acknowledgedResultIdRef.current = null;
      lastResultPredictionIdRef.current = null;
      resultDismissScheduledRef.current = false;
      clearResultTimers();
      resetToWaitStart();
      if (data.predictionEnabled) {
        setPredictionEnabled(true);
        setScreenPhase("picking");
      } else {
        setPredictionEnabled(false);
        setScreenPhase("wait_start");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    }, [resetToWaitStart, clearResultTimers]),

    onScoreboardUpdate: useCallback((data: { scoreboard?: LiveScoreboard }) => {
      if (data?.scoreboard) onScoreboardRef.current?.(data.scoreboard);
    }, []),
  };

  useMatchWebSocket({
    matchId: selectedMatch?.id ?? null,
    userId: user?.id ?? null,
    autoConnect: Boolean(selectedMatch?.id && user),
    handlers: wsHandlers,
  });

  const handleFieldSelect = useCallback(
    (option: PredictionOption) => {
      if (screenPhase !== "picking" || !predictionEnabled) {
        toast({ description: "아직 예측이 시작되지 않았습니다.", variant: "destructive" });
        return;
      }
      setSelectedPrediction(option);
      setShowBetModal(true);
    },
    [screenPhase, predictionEnabled, toast],
  );

  const handleBetNext = useCallback(() => {
    setShowBetModal(false);
    setShowConfirmModal(true);
  }, []);

  const handleConfirmCancel = useCallback(() => {
    setShowConfirmModal(false);
    setSelectedPrediction(null);
  }, []);

  const handleConfirmSubmit = useCallback(async () => {
    if (!user || !selectedMatch || !selectedPrediction) return;

    setShowConfirmModal(false);
    waitingResultRef.current = true;
    acknowledgedResultIdRef.current = null;
    lastResultPredictionIdRef.current = null;
    setScreenPhase("wait_result");

    try {
      const res = await apiRequest("POST", "/api/live-match/predictions", {
        matchId: selectedMatch.id,
        prediction: selectedPrediction,
        amount: selectedBetAmount,
      });
      const data = await res.json();
      activeBetRef.current = {
        round: data.roundNumber,
        prediction: selectedPrediction,
        predictionId: data.id,
        amount: selectedBetAmount,
      };
      lastResultPredictionIdRef.current = data.id;
      setLastBetAmount(selectedBetAmount);
      setUser({ ...user, points: (user.points ?? 0) - selectedBetAmount });
    } catch (error: unknown) {
      waitingResultRef.current = false;
      activeBetRef.current = null;
      setScreenPhase(predictionEnabled ? "picking" : "wait_start");
      setSelectedPrediction(null);
      toast({
        description: error instanceof Error ? error.message : "예측 제출에 실패했습니다.",
        variant: "destructive",
      });
    }
  }, [user, selectedMatch, selectedPrediction, selectedBetAmount, setUser, predictionEnabled, toast]);

  const labelsVisible =
    screenPhase === "wait_start" ||
    screenPhase === "picking" ||
    screenPhase === "wait_result";
  const labelsInteractive = screenPhase === "picking";
  const blinkPrediction =
    screenPhase === "wait_result" ? selectedPrediction : null;

  return {
    screenPhase,
    predictionEnabled,
    selectedPrediction,
    selectedBetAmount,
    setSelectedBetAmount,
    showBetModal,
    setShowBetModal,
    showConfirmModal,
    predictionResult,
    lastWonAmount,
    lastBetAmount,
    resultCountdown,
    labelsVisible,
    labelsInteractive,
    blinkPrediction,
    handleFieldSelect,
    handleBetNext,
    handleConfirmCancel,
    handleConfirmSubmit,
    handleRunComplete,
  };
}
