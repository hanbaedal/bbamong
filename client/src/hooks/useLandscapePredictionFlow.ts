import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMatchWebSocket, type WSEventHandlers } from "@/hooks/useMatchWebSocket";
import { useAdMob } from "@/hooks/useAdMob";
import { apiRequest, keepAliveUserSession, queryClient } from "@/lib/queryClient";
import { useUser } from "@/contexts/UserContext";
import { shouldClientPollMatch } from "@/lib/matchPollWindow";
import { subscribeForegroundResume } from "@/lib/foregroundResume";
import { resumeMobileAudio } from "@/lib/mobileAudioUnlock";
import {
  DEFAULT_BET_AMOUNT,
  calculateFixedOddsPayout,
  type BetAmountOption,
} from "@shared/predictionOdds";
import type {
  GameScreenPhase,
  PredictionOption,
  PredictionResult,
  RoundAdvanceType,
} from "@/components/game/gameTypes";
import { GAME_EVENT_SHOW_MS, MATCH_ENDED_SHOW_MS, SUCCESS_HOP_MS, isSuccessPresentationPhase } from "@/components/game/gameTypes";
import { speakGameVoice } from "@/lib/gameVoiceAnnouncements";
import { consumeFirstPredictionOpen } from "@/lib/gameVoiceSession";
import {
  ackPredictionResult,
  isPredictionResultAcked,
  listAckedPredictionResults,
} from "@/lib/predictionResultAck";
import {
  clearAdSessionDismissed,
  markAdSessionDismissed,
  wasAdSessionDismissed,
} from "@/lib/adDismissSession";

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

/** 결과 연출 중 도착한 round_next — 축하/실패 UI가 끝난 뒤 적용 */
interface PendingRoundNext {
  advanceType: RoundAdvanceType;
  gamePhaseDisplayLabel?: string;
  predictionEnabled?: boolean;
}

/** 성공·실패 결과 배너 자동 종료 (동일 시간 — 메시지 인지에 충분하고 반복 플레이 시 지루함 적음) */
const RESULT_AUTO_MS = 5000;

export function useLandscapePredictionFlow(
  selectedMatch: MatchFlowData | null,
  options?: {
    onScoreboardUpdate?: (scoreboard: LiveScoreboard) => void;
    onGamePhaseUpdate?: (phase: unknown) => void;
    onMatchEnded?: () => void;
  },
) {
  const { user, setUser } = useUser();
  const { toast } = useToast();
  const onScoreboardRef = useRef(options?.onScoreboardUpdate);
  const onGamePhaseRef = useRef(options?.onGamePhaseUpdate);
  onScoreboardRef.current = options?.onScoreboardUpdate;
  onGamePhaseRef.current = options?.onGamePhaseUpdate;

  const [screenPhase, setScreenPhaseState] = useState<GameScreenPhase>("wait_start");
  const setScreenPhase = useCallback((next: GameScreenPhase) => {
    screenPhaseRef.current = next;
    setScreenPhaseState(next);
  }, []);
  const [predictionEnabled, setPredictionEnabled] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionOption | null>(null);
  const [selectedBetAmount, setSelectedBetAmount] = useState<BetAmountOption>(DEFAULT_BET_AMOUNT);
  const [showBetModal, setShowBetModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [predictionResult, setPredictionResult] = useState<PredictionResult>("pending");
  const [lastWonAmount, setLastWonAmount] = useState(0);
  const [lastBetAmount, setLastBetAmount] = useState(0);
  const [resultCountdown, setResultCountdown] = useState<number | null>(null);
  const [eventCountdown, setEventCountdown] = useState<number | null>(null);
  const [eventSubtitle, setEventSubtitle] = useState("");
  const [showAdOverlay, setShowAdOverlay] = useState(false);

  const activeBetRef = useRef<ActiveBet | null>(null);
  /** activeBet이 비워져도 round_result 연출용으로 유지 */
  const betSnapshotRef = useRef<ActiveBet | null>(null);
  const waitingResultRef = useRef(false);
  const resultShownRef = useRef(false);
  const lastResultPredictionIdRef = useRef<number | null>(null);
  const acknowledgedResultIdRef = useRef<number | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventCountdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingRewardKeyRef = useRef<string | null>(null);
  const adSessionActiveRef = useRef(false);
  const adDismissedEarlyRef = useRef(false);
  const adStartedAtRef = useRef<number | null>(null);
  const matchEndedRef = useRef(false);
  const failVoiceSpokenRef = useRef(false);
  const matchEndedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const predictionEnabledRef = useRef(false);
  const screenPhaseRef = useRef<GameScreenPhase>("wait_start");
  const pendingRoundNextRef = useRef<PendingRoundNext | null>(null);
  /** 결과 연출 중 도착한 전면광고 — 연출/교체 이벤트 후 재생 */
  const pendingInterstitialRef = useRef(false);
  /** 결과 연출 중에 prediction_started가 온 경우, 연출 종료 후 picking으로 */
  const wantPickingAfterResultRef = useRef(false);
  const resultDismissScheduledRef = useRef(false);
  const successRunTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMatchEndedRef = useRef(options?.onMatchEnded);
  onMatchEndedRef.current = options?.onMatchEnded;

  const {
    startAdSession,
    stopAdSession,
    adSessionState,
    isNativePlatform,
  } = useAdMob();

  useEffect(() => {
    predictionEnabledRef.current = predictionEnabled;
  }, [predictionEnabled]);

  useEffect(() => {
    screenPhaseRef.current = screenPhase;
  }, [screenPhase]);

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

  const clearSuccessRunTimer = useCallback(() => {
    if (successRunTimerRef.current) {
      clearTimeout(successRunTimerRef.current);
      successRunTimerRef.current = null;
    }
  }, []);

  const beginSuccessPresentation = useCallback(() => {
    clearSuccessRunTimer();
    // 배트 연출·주루를 먼저 보여 주고, 도착 후 축하 배너를 띄운다
    setScreenPhase("success_running");
  }, [clearSuccessRunTimer]);

  const clearEventTimers = useCallback(() => {
    if (eventTimerRef.current) {
      clearTimeout(eventTimerRef.current);
      eventTimerRef.current = null;
    }
    if (eventCountdownIntervalRef.current) {
      clearInterval(eventCountdownIntervalRef.current);
      eventCountdownIntervalRef.current = null;
    }
    setEventCountdown(null);
  }, []);

  const goToWaitStart = useCallback(() => {
    clearResultTimers();
    clearEventTimers();
    clearSuccessRunTimer();
    pendingRoundNextRef.current = null;
    pendingInterstitialRef.current = false;
    wantPickingAfterResultRef.current = false;
    resultShownRef.current = false;
    waitingResultRef.current = false;
    activeBetRef.current = null;
    betSnapshotRef.current = null;
    setSelectedPrediction(null);
    setPredictionResult("pending");
    setShowBetModal(false);
    setShowConfirmModal(false);
    setLastWonAmount(0);
    setLastBetAmount(0);
    setPredictionEnabled(false);
    setEventSubtitle("");
    setScreenPhase("wait_start");
  }, [clearResultTimers, clearEventTimers, clearSuccessRunTimer]);

  const handleMatchEnded = useCallback(() => {
    if (matchEndedRef.current) return;
    matchEndedRef.current = true;

    pendingInterstitialRef.current = false;
    adSessionActiveRef.current = false;
    stopAdSession();
    setShowAdOverlay(false);
    setShowBetModal(false);
    setShowConfirmModal(false);
    setScreenPhase("match_ended");
    void speakGameVoice("user.matchEnded", 8_000);

    const exitGame = () => {
      toast({ description: "경기가 종료되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      onMatchEndedRef.current?.();
    };

    if (matchEndedTimerRef.current) {
      clearTimeout(matchEndedTimerRef.current);
    }
    matchEndedTimerRef.current = setTimeout(exitGame, MATCH_ENDED_SHOW_MS);
  }, [toast, stopAdSession]);

  useEffect(() => {
    matchEndedRef.current = false;
    failVoiceSpokenRef.current = false;
    if (matchEndedTimerRef.current) {
      clearTimeout(matchEndedTimerRef.current);
      matchEndedTimerRef.current = null;
    }
  }, [selectedMatch?.id]);

  useEffect(
    () => () => {
      if (matchEndedTimerRef.current) {
        clearTimeout(matchEndedTimerRef.current);
      }
    },
    [],
  );

  const finishAdAndWaitStart = useCallback(() => {
    adSessionActiveRef.current = false;
    stopAdSession();
    setShowAdOverlay(false);
    pendingRewardKeyRef.current = null;
    goToWaitStart();
  }, [stopAdSession, goToWaitStart]);

  const rememberAdStartedAt = useCallback((startedAt?: number | null) => {
    if (typeof startedAt === "number" && Number.isFinite(startedAt)) {
      adStartedAtRef.current = startedAt;
    }
  }, []);

  const skipDismissedAdSession = useCallback(
    (matchId?: string, startedAt?: number | null) => {
      const id = matchId ?? selectedMatch?.id;
      const at = startedAt ?? adStartedAtRef.current;
      if (!id || at == null) return false;
      if (!wasAdSessionDismissed(id, at)) return false;
      adDismissedEarlyRef.current = true;
      adSessionActiveRef.current = false;
      pendingInterstitialRef.current = false;
      pendingRewardKeyRef.current = null;
      stopAdSession();
      setShowAdOverlay(false);
      if (screenPhaseRef.current === "ad_playing") {
        setScreenPhase(predictionEnabledRef.current ? "picking" : "wait_start");
      }
      return true;
    },
    [selectedMatch?.id, stopAdSession],
  );

  const claimAdRewardIfPending = useCallback(
    async (matchId?: string) => {
      const rewardKey = pendingRewardKeyRef.current;
      if (!rewardKey || !matchId) return;
      pendingRewardKeyRef.current = null;
      try {
        const res = await apiRequest("POST", "/api/live-match/ad-reward", {
          matchId,
          rewardKey,
        });
        if (res.ok) {
          const rewardData = await res.json();
          if (user && typeof rewardData.balance === "number") {
            setUser({ ...user, points: rewardData.balance });
          }
          toast({ description: "광고 시청 보상 500P가 지급되었습니다." });
        }
      } catch {
        /* ignore */
      }
    },
    [user, setUser, toast],
  );

  /** 사용자 X(5초 후) — 보상 없음. 같은 광고 세션은 복귀해도 다시 띄우지 않음 */
  const handleAdOverlayDismiss = useCallback(() => {
    adDismissedEarlyRef.current = true;
    markAdSessionDismissed(selectedMatch?.id ?? "", adStartedAtRef.current);
    finishAdAndWaitStart();
  }, [finishAdAndWaitStart, selectedMatch?.id]);

  const grantRewardIfWatchedUntilOperatorStop = useCallback(
    async (matchId?: string) => {
      if (!adSessionActiveRef.current || adDismissedEarlyRef.current) return;
      await claimAdRewardIfPending(matchId);
    },
    [claimAdRewardIfPending],
  );

  const scheduleEventDismiss = useCallback(
    (ms: number, onDone?: () => void) => {
      clearEventTimers();
      const sec = Math.ceil(ms / 1000);
      setEventCountdown(sec);
      eventCountdownIntervalRef.current = setInterval(() => {
        setEventCountdown((prev) => (prev != null && prev > 1 ? prev - 1 : prev));
      }, 1000);
      eventTimerRef.current = setTimeout(() => {
        clearEventTimers();
        setEventSubtitle("");
        // 광고가 이미 재생 중이면 이벤트 종료가 ad_playing을 덮어쓰지 않음
        if (adSessionActiveRef.current || screenPhaseRef.current === "ad_playing") {
          onDone?.();
          return;
        }
        // 보류 광고가 있으면 이벤트 종료 직후 재생 (wait_start로 먼저 가지 않음)
        if (pendingInterstitialRef.current) {
          onDone?.();
          return;
        }
        setScreenPhase(
          wantPickingAfterResultRef.current || predictionEnabledRef.current ? "picking" : "wait_start",
        );
        wantPickingAfterResultRef.current = false;
        onDone?.();
      }, ms);
    },
    [clearEventTimers],
  );

  const isInResultPresentation = useCallback(() => {
    const phase = screenPhaseRef.current;
    return (
      resultShownRef.current ||
      isSuccessPresentationPhase(phase) ||
      phase === "fail"
    );
  }, []);

  /** 결과 대기 중 — round_next로 대기 UI를 지우지 않음 (결과 생략·환불은 제외) */
  const isWaitingForResult = useCallback(() => {
    return (
      waitingResultRef.current ||
      activeBetRef.current != null ||
      screenPhaseRef.current === "wait_result"
    );
  }, []);

  const rememberActiveBet = useCallback((bet: ActiveBet) => {
    activeBetRef.current = bet;
    betSnapshotRef.current = bet;
  }, []);

  const clearResultPresentationState = useCallback(() => {
    resultShownRef.current = false;
    waitingResultRef.current = false;
    activeBetRef.current = null;
    betSnapshotRef.current = null;
    setSelectedPrediction(null);
    setPredictionResult("pending");
    setShowBetModal(false);
    setShowConfirmModal(false);
    setLastWonAmount(0);
    setLastBetAmount(0);
  }, []);

  const runInterstitialSession = useCallback(
    async (matchId?: string, startedAt?: number | null) => {
      rememberAdStartedAt(startedAt);
      if (skipDismissedAdSession(matchId, startedAt ?? adStartedAtRef.current)) return;
      if (adSessionActiveRef.current || screenPhaseRef.current === "ad_playing") return;
      adSessionActiveRef.current = true;
      adDismissedEarlyRef.current = false;
      setShowBetModal(false);
      setShowConfirmModal(false);
      setScreenPhase("ad_playing");

      if (isNativePlatform) {
        const { dismissedEarly, mode } = await startAdSession();
        if (!adSessionActiveRef.current) {
          finishAdAndWaitStart();
          return;
        }

        if (mode === "overlay") {
          setShowAdOverlay(true);
          return;
        }

        if (dismissedEarly) {
          adDismissedEarlyRef.current = true;
          markAdSessionDismissed(matchId ?? selectedMatch?.id ?? "", adStartedAtRef.current);
          finishAdAndWaitStart();
          return;
        }

        // 전면 종료 후에도 운영자 중지까지 오버레이 대기 — 그때 500P
        setShowAdOverlay(true);
        return;
      }

      setShowAdOverlay(true);
    },
    [
      isNativePlatform,
      startAdSession,
      finishAdAndWaitStart,
      rememberAdStartedAt,
      skipDismissedAdSession,
      selectedMatch?.id,
    ],
  );

  const flushPendingInterstitial = useCallback(async () => {
    if (!pendingInterstitialRef.current) return;
    pendingInterstitialRef.current = false;
    await runInterstitialSession(selectedMatch?.id, adStartedAtRef.current);
  }, [runInterstitialSession, selectedMatch?.id]);

  const applyRoundNextAdvance = useCallback(
    (pending: PendingRoundNext) => {
      clearResultTimers();
      clearEventTimers();
      clearSuccessRunTimer();
      clearResultPresentationState();
      setEventSubtitle("");

      const enabled = Boolean(pending.predictionEnabled) || wantPickingAfterResultRef.current;
      if (pending.predictionEnabled !== undefined) {
        setPredictionEnabled(Boolean(pending.predictionEnabled) || wantPickingAfterResultRef.current);
      }

      const advanceType = pending.advanceType;
      if (advanceType === "pitcher_change") {
        void speakGameVoice("user.pitcherChange");
        // 서버 광고(5초)와 이벤트 종료를 맞추기 위해 보류 플래그 선설정
        pendingInterstitialRef.current = true;
        setScreenPhase("pitcher_change_event");
        scheduleEventDismiss(GAME_EVENT_SHOW_MS, () => {
          void flushPendingInterstitial();
        });
        return;
      }
      if (advanceType === "switch_half") {
        void speakGameVoice("user.switchHalf");
        pendingInterstitialRef.current = true;
        setEventSubtitle(pending.gamePhaseDisplayLabel ?? "");
        setScreenPhase("inning_switch_event");
        scheduleEventDismiss(GAME_EVENT_SHOW_MS, () => {
          void flushPendingInterstitial();
        });
        return;
      }

      pendingInterstitialRef.current = false;
      wantPickingAfterResultRef.current = false;
      setScreenPhase(enabled ? "picking" : "wait_start");
    },
    [
      clearResultTimers,
      clearEventTimers,
      clearSuccessRunTimer,
      clearResultPresentationState,
      scheduleEventDismiss,
      flushPendingInterstitial,
    ],
  );

  const finishResultPresentation = useCallback(() => {
    resultDismissScheduledRef.current = false;
    if (lastResultPredictionIdRef.current != null) {
      acknowledgedResultIdRef.current = lastResultPredictionIdRef.current;
      if (selectedMatch?.id) {
        ackPredictionResult(selectedMatch.id, lastResultPredictionIdRef.current);
      }
    }
    clearResultTimers();
    clearSuccessRunTimer();

    const pending = pendingRoundNextRef.current;
    pendingRoundNextRef.current = null;
    if (pending) {
      applyRoundNextAdvance(pending);
      return;
    }

    clearResultPresentationState();
    const goPicking = wantPickingAfterResultRef.current || predictionEnabledRef.current;
    wantPickingAfterResultRef.current = false;
    setScreenPhase(goPicking ? "picking" : "wait_start");
  }, [
    clearResultTimers,
    clearSuccessRunTimer,
    clearResultPresentationState,
    applyRoundNextAdvance,
    selectedMatch?.id,
  ]);

  const scheduleResultDismiss = useCallback(
    (ms: number) => {
      clearResultTimers();
      const sec = Math.ceil(ms / 1000);
      setResultCountdown(sec);
      countdownIntervalRef.current = setInterval(() => {
        setResultCountdown((prev) => (prev != null && prev > 1 ? prev - 1 : prev));
      }, 1000);
      resultTimerRef.current = setTimeout(() => {
        finishResultPresentation();
      }, ms);
    },
    [clearResultTimers, finishResultPresentation],
  );

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

      const presenting =
        resultShownRef.current ||
        isSuccessPresentationPhase(screenPhaseRef.current) ||
        screenPhaseRef.current === "fail";

      if (data.hasPrediction) {
        const resolvedId = data.predictionId ?? null;
        const isResolved = data.status === "success" || data.status === "fail";
        const matchId = selectedMatch?.id ?? "";
        const alreadyAcked =
          resolvedId != null &&
          (resolvedId === acknowledgedResultIdRef.current ||
            (matchId ? isPredictionResultAcked(matchId, resolvedId) : false));

        if (isResolved && alreadyAcked) {
          if (presenting) return;
          if (resolvedId != null) acknowledgedResultIdRef.current = resolvedId;
          activeBetRef.current = null;
          betSnapshotRef.current = null;
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
          // 이미 같은 예측 결과 연출 중이면 재진입하지 않음
          if (
            presenting &&
            resolvedId != null &&
            resolvedId === lastResultPredictionIdRef.current
          ) {
            return;
          }
          if (presenting) return;
          if (resolvedId != null) lastResultPredictionIdRef.current = resolvedId;
          resultShownRef.current = true;
          setPredictionResult(data.status as PredictionResult);
          setLastWonAmount(data.wonAmount ?? 0);
          if (data.status === "success") beginSuccessPresentation();
          else setScreenPhase("fail");
          activeBetRef.current = null;
        } else {
          if (presenting) return;
          if (resolvedId != null) lastResultPredictionIdRef.current = resolvedId;
          rememberActiveBet({
            round: data.roundNumber ?? 0,
            prediction: data.prediction as PredictionOption,
            predictionId: resolvedId ?? 0,
            amount: data.amount ?? DEFAULT_BET_AMOUNT,
          });
          setScreenPhase("wait_result");
        }
        return;
      }

      if (presenting || waitingResultRef.current) return;

      activeBetRef.current = null;
      betSnapshotRef.current = null;
      waitingResultRef.current = false;
      if (enabled) {
        setScreenPhase("picking");
      } else {
        setScreenPhase("wait_start");
      }
    },
    [rememberActiveBet, beginSuccessPresentation, selectedMatch?.id],
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

  const checkPredictionStatusRef = useRef(checkPredictionStatus);
  checkPredictionStatusRef.current = checkPredictionStatus;

  const syncMatchFromServer = useCallback(async () => {
    if (!selectedMatch?.id) return;
    if (!shouldClientPollMatch(selectedMatch.startTime, selectedMatch.matchStatus)) return;
    if (resultShownRef.current) return;
    try {
      const res = await apiRequest("GET", `/api/matches/${selectedMatch.id}`);
      if (!res.ok) return;
      const matchData = await res.json();
      if (matchData.matchStatus === "completed" || matchData.matchStatus === "cancelled") {
        handleMatchEnded();
        return;
      }
      setPredictionEnabled(Boolean(matchData.predictionEnabled));

      if (
        screenPhaseRef.current === "wait_start" &&
        matchData.predictionEnabled &&
        !waitingResultRef.current
      ) {
        setScreenPhase("picking");
      }
    } catch {
      /* ignore */
    }
  }, [selectedMatch?.id, selectedMatch?.startTime, selectedMatch?.matchStatus, handleMatchEnded]);

  const syncMatchFromServerRef = useRef(syncMatchFromServer);
  syncMatchFromServerRef.current = syncMatchFromServer;

  useEffect(() => {
    if (!selectedMatch?.id) return;
    // 메뉴 왕복 리마운트 시에도 이미 본 결과는 세션 ack로 유지
    const acked = listAckedPredictionResults(selectedMatch.id);
    acknowledgedResultIdRef.current = acked.length > 0 ? acked[acked.length - 1]! : null;
    lastResultPredictionIdRef.current = null;
    resultDismissScheduledRef.current = false;
    pendingRoundNextRef.current = null;
    pendingInterstitialRef.current = false;
    wantPickingAfterResultRef.current = false;
    void checkPredictionStatus();
    // checkPredictionStatus 정체성 변화로 재실행되면 ack·pending이 지워지므로 matchId만 의존
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount restore keyed by match
  }, [selectedMatch?.id]);

  useEffect(() => {
    if (!selectedMatch?.id) return;
    return subscribeForegroundResume(() => {
      void keepAliveUserSession();
      void resumeMobileAudio();
      void checkPredictionStatusRef.current();
      void syncMatchFromServerRef.current();
    });
  }, [selectedMatch?.id]);

  useEffect(() => {
    if (!selectedMatch?.id) return;
    if (!shouldClientPollMatch(selectedMatch.startTime, selectedMatch.matchStatus)) return;

    void syncMatchFromServer();
    const id = setInterval(() => {
      void syncMatchFromServer();
    }, 8000);
    return () => clearInterval(id);
  }, [selectedMatch?.id, selectedMatch?.startTime, selectedMatch?.matchStatus, syncMatchFromServer]);

  useEffect(() => {
    if (screenPhase !== "wait_result" || predictionResult !== "pending" || !selectedMatch?.id) return;

    const id = setInterval(() => {
      void (async () => {
        try {
          const res = await apiRequest("GET", `/api/live-match/predictions/${selectedMatch.id}/check`);
          if (!res.ok) return;
          const data = await res.json();
          if (data.status === "success" || data.status === "fail") {
            // 이미 결과 연출 중이거나, round_next로 페이즈가 바뀐 뒤 도착한 stale 응답 무시
            if (resultShownRef.current) return;
            const phase = screenPhaseRef.current;
            if (
              phase === "success_announce" ||
              phase === "success_running" ||
              phase === "success_celebrate" ||
              phase === "fail" ||
              phase !== "wait_result"
            ) {
              return;
            }
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
          if (data.status === "success") beginSuccessPresentation();
          else setScreenPhase("fail");
          }
        } catch {
          /* ignore */
        }
      })();
    }, 2000);

    return () => clearInterval(id);
  }, [screenPhase, predictionResult, selectedMatch?.id, user, setUser, beginSuccessPresentation]);

  const handleRunComplete = useCallback(() => {
    void speakGameVoice("user.predictionSuccess");
    setScreenPhase("success_celebrate");
  }, []);

  useEffect(() => {
    if (screenPhase === "fail" && !failVoiceSpokenRef.current) {
      failVoiceSpokenRef.current = true;
      void speakGameVoice("user.predictionFail");
    }
    if (
      screenPhase === "picking" ||
      screenPhase === "wait_start" ||
      screenPhase === "wait_result"
    ) {
      failVoiceSpokenRef.current = false;
    }
  }, [screenPhase]);

  useEffect(() => {
    if (screenPhase !== "success_celebrate" && screenPhase !== "fail") {
      resultDismissScheduledRef.current = false;
      return;
    }
    if (resultDismissScheduledRef.current) return;
    resultDismissScheduledRef.current = true;
    scheduleResultDismiss(screenPhase === "fail" ? RESULT_AUTO_MS : SUCCESS_HOP_MS);
  }, [screenPhase, scheduleResultDismiss]);

  const handleRoundResult = useCallback(
    (data: { result?: string; wonAmount?: number }) => {
      if (resultShownRef.current) return;
      const bet = activeBetRef.current ?? betSnapshotRef.current;
      if (!bet) {
        // activeBet이 비었어도 대기 중이면 /check 로 연출 복구
        if (isWaitingForResult()) {
          void checkPredictionStatus();
        }
        return;
      }

      const isSuccess = data.result === bet.prediction;
      if (bet.predictionId) lastResultPredictionIdRef.current = bet.predictionId;
      resultShownRef.current = true;
      waitingResultRef.current = false;
      setPredictionResult(isSuccess ? "success" : "fail");
      setLastWonAmount(data.wonAmount ?? 0);
      setLastBetAmount(bet.amount);
      setSelectedPrediction(bet.prediction);
      activeBetRef.current = null;

      if (isSuccess) {
        if (user) {
          const won = data.wonAmount ?? calculateFixedOddsPayout(bet.amount, bet.prediction);
          setLastWonAmount(won);
          if (won > 0) setUser({ ...user, points: (user.points ?? 0) + won });
        }
        beginSuccessPresentation();
      } else {
        setScreenPhase("fail");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    },
    [user, setUser, isWaitingForResult, checkPredictionStatus, beginSuccessPresentation],
  );

  const wsHandlers: WSEventHandlers = {
    onConnected: useCallback((data: { predictionEnabled?: boolean }) => {
      if (data.predictionEnabled !== undefined) {
        setPredictionEnabled(data.predictionEnabled);
        if (!resultShownRef.current && !waitingResultRef.current) {
          setScreenPhase(data.predictionEnabled ? "picking" : "wait_start");
        }
      }
      // 전화·SNS 복귀 재연결 시 놓친 결과/타석을 /check 로 맞춤
      void checkPredictionStatus();
    }, [checkPredictionStatus]),

    onPredictionStarted: useCallback(() => {
      const key = consumeFirstPredictionOpen(selectedMatch?.id)
        ? "user.predictionOpenFirst"
        : "user.predictionOpen";
      void speakGameVoice(key);
      // 예측 시작 = 광고 중지 (보상 없음)
      pendingInterstitialRef.current = false;
      adSessionActiveRef.current = false;
      stopAdSession();
      setShowAdOverlay(false);

      // 결과 연출 중이면 끊지 않고, 끝난 뒤 picking으로 이어감
      if (isInResultPresentation()) {
        setPredictionEnabled(true);
        wantPickingAfterResultRef.current = true;
        if (pendingRoundNextRef.current) {
          pendingRoundNextRef.current = {
            ...pendingRoundNextRef.current,
            predictionEnabled: true,
          };
        }
        return;
      }
      // 이전 타석 결과대기 잔류 + 새 예측 시작 = 고착 복구 (대타/공수 후 메뉴 왕복으로만 풀리던 증상)
      if (waitingResultRef.current || activeBetRef.current) {
        clearResultPresentationState();
        toast({
          description: "이전 타석 대기를 해제하고 새 예측을 시작합니다.",
          duration: 3500,
        });
      }
      resultShownRef.current = false;
      setPredictionEnabled(true);
      setSelectedPrediction(null);
      setScreenPhase("picking");
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    }, [isInResultPresentation, stopAdSession, clearResultPresentationState, toast, selectedMatch?.id]),

    onPredictionEnded: useCallback(() => {
      void speakGameVoice("user.predictionClose");
      setPredictionEnabled(false);
      wantPickingAfterResultRef.current = false;
      setShowBetModal(false);
      setShowConfirmModal(false);
      if (isInResultPresentation()) {
        if (pendingRoundNextRef.current) {
          pendingRoundNextRef.current = {
            ...pendingRoundNextRef.current,
            predictionEnabled: false,
          };
        }
        return;
      }
      if (waitingResultRef.current || activeBetRef.current) {
        setScreenPhase("wait_result");
        return;
      }
      setSelectedPrediction(null);
      setScreenPhase("wait_start");
    }, [isInResultPresentation]),

    onUserAlreadyPredicted: useCallback((data: {
      prediction: string;
      predictionId?: number;
      round?: number;
      amount?: number;
      status?: string;
      wonAmount?: number;
    }) => {
      const matchId = selectedMatch?.id ?? "";
      if (
        data.predictionId != null &&
        (data.predictionId === acknowledgedResultIdRef.current ||
          (matchId ? isPredictionResultAcked(matchId, data.predictionId) : false))
      ) {
        if (data.predictionId != null) acknowledgedResultIdRef.current = data.predictionId;
        return;
      }
      if (
        resultShownRef.current &&
        data.predictionId != null &&
        data.predictionId === lastResultPredictionIdRef.current
      ) {
        return;
      }

      waitingResultRef.current = true;
      setSelectedPrediction(data.prediction as PredictionOption);
      setLastBetAmount(data.amount ?? DEFAULT_BET_AMOUNT);

      if (data.status === "success" || data.status === "fail") {
        if (data.predictionId != null) lastResultPredictionIdRef.current = data.predictionId;
        resultShownRef.current = true;
        setPredictionResult(data.status);
        setLastWonAmount(data.wonAmount ?? 0);
        if (data.status === "success") beginSuccessPresentation();
        else setScreenPhase("fail");
        return;
      }

      rememberActiveBet({
        round: data.round ?? 0,
        prediction: data.prediction as PredictionOption,
        predictionId: data.predictionId ?? 0,
        amount: data.amount ?? DEFAULT_BET_AMOUNT,
      });
      setScreenPhase("wait_result");
    }, [rememberActiveBet, beginSuccessPresentation, selectedMatch?.id]),

    onPredictionCancelled: useCallback(
      (data: { message?: string }) => {
        // 시작 취소(1초) — 환불됨. 대기/연출 중이면 끊지 않고 안내만 (연출 보호)
        if (isInResultPresentation()) {
          setPredictionEnabled(false);
          wantPickingAfterResultRef.current = false;
          toast({
            description: data.message ?? "예측 시작이 취소되었습니다.",
            duration: 3500,
          });
          return;
        }
        const hadBet = isWaitingForResult();
        clearResultPresentationState();
        pendingRoundNextRef.current = null;
        setPredictionEnabled(false);
        setScreenPhase("wait_start");
        toast({
          description: hadBet
            ? "예측이 취소되어 포인트가 환불되었습니다."
            : (data.message ?? "예측 시작이 취소되었습니다."),
          duration: 4000,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
        queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      },
      [clearResultPresentationState, isInResultPresentation, isWaitingForResult, toast],
    ),

    onRoundResult: useCallback((data: { result?: string; wonAmount?: number }) => {
      handleRoundResult(data);
    }, [handleRoundResult]),

    onRoundNext: useCallback((data: {
      predictionEnabled?: boolean;
      gamePhase?: { displayLabel?: string };
      skippedResult?: boolean;
      advanceType?: RoundAdvanceType;
    }) => {
      if (data.gamePhase) onGamePhaseRef.current?.(data.gamePhase);

      const hadPendingBet =
        waitingResultRef.current ||
        activeBetRef.current != null ||
        betSnapshotRef.current != null ||
        screenPhaseRef.current === "wait_result" ||
        screenPhaseRef.current === "success_announce" ||
        screenPhaseRef.current === "success_running" ||
        screenPhaseRef.current === "success_celebrate" ||
        screenPhaseRef.current === "fail";

      if (data.skippedResult && hadPendingBet) {
        if (data.advanceType === "pitcher_change") {
          void speakGameVoice("user.predictionCancelledPitcher");
        }
        toast({
          description:
            data.advanceType === "pitcher_change"
              ? "투수 교체로 이번 예측이 취소되어 포인트가 환불되었습니다."
              : "이번 라운드 결과가 생략되었습니다. 포인트는 환불됩니다.",
          duration: 4500,
        });
      }

      const pendingPayload: PendingRoundNext = {
        advanceType: data.advanceType ?? "next_batter",
        gamePhaseDisplayLabel: data.gamePhase?.displayLabel,
        predictionEnabled: data.predictionEnabled,
      };

      // 성공 축하·주루 / 실패 배너 중이면 round_next로 끊지 않음
      if (isInResultPresentation()) {
        pendingRoundNextRef.current = pendingPayload;
        queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
        return;
      }

      // 결과 대기 중 — 결과 생략(환불)이 아니면 대기 UI 유지 후 결과 연출 → 이어서 적용
      if (isWaitingForResult() && !data.skippedResult) {
        pendingRoundNextRef.current = pendingPayload;
        queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
        return;
      }

      pendingRoundNextRef.current = null;
      acknowledgedResultIdRef.current = null;
      lastResultPredictionIdRef.current = null;
      resultDismissScheduledRef.current = false;
      applyRoundNextAdvance(pendingPayload);
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    }, [applyRoundNextAdvance, isInResultPresentation, isWaitingForResult, toast]),

    onRewardedAdOffer: useCallback((data: { rewardKey?: string; matchId?: string }) => {
      pendingRewardKeyRef.current = data?.rewardKey ?? `${data?.matchId ?? "match"}:${Date.now()}`;
    }, []),

    onAdStarted: useCallback(
      async (data: { matchId?: string; adStartedAt?: number }) => {
        rememberAdStartedAt(data?.adStartedAt);
        if (skipDismissedAdSession(data?.matchId ?? selectedMatch?.id, data?.adStartedAt)) return;
        const phase = screenPhaseRef.current;
        const duringSwitchOrPitcher =
          phase === "inning_switch_event" || phase === "pitcher_change_event";
        // 결과 연출·대기·공수/투수 안내 중이면 보류 → 이벤트 종료(flush) 또는 이후 onAdStarted로 재생
        if (
          resultShownRef.current ||
          isWaitingForResult() ||
          isInResultPresentation() ||
          duringSwitchOrPitcher
        ) {
          pendingInterstitialRef.current = true;
          return;
        }
        await runInterstitialSession(data?.matchId, data?.adStartedAt);
      },
      [
        isWaitingForResult,
        isInResultPresentation,
        runInterstitialSession,
        rememberAdStartedAt,
        skipDismissedAdSession,
        selectedMatch?.id,
      ],
    ),

    onAdStopped: useCallback((data?: { reason?: string }) => {
      void (async () => {
        const reason = data?.reason;
        const fromPredictionStart = reason === "prediction_start";
        const fromRoundAdvance = reason === "round_advance";

        if (fromPredictionStart || fromRoundAdvance) {
          pendingRewardKeyRef.current = null;
        } else {
          await grantRewardIfWatchedUntilOperatorStop(selectedMatch?.id);
        }

        adSessionActiveRef.current = false;
        stopAdSession();
        setShowAdOverlay(false);
        clearAdSessionDismissed(selectedMatch?.id);
        adStartedAtRef.current = null;

        if (isInResultPresentation() || isWaitingForResult()) {
          if (!fromRoundAdvance) pendingInterstitialRef.current = false;
          return;
        }

        const phase = screenPhaseRef.current;
        if (phase === "pitcher_change_event" || phase === "inning_switch_event") {
          return;
        }

        // 예측 시작으로 광고가 꺼진 경우 wait_start로 덮지 않음 (보상 없음)
        if (
          fromPredictionStart ||
          phase === "picking" ||
          predictionEnabledRef.current
        ) {
          pendingInterstitialRef.current = false;
          if (phase === "ad_playing") setScreenPhase("picking");
          return;
        }

        if (fromRoundAdvance) {
          if (phase === "ad_playing") setScreenPhase("wait_start");
          return;
        }

        finishAdAndWaitStart();
      })();
    }, [
      grantRewardIfWatchedUntilOperatorStop,
      selectedMatch?.id,
      finishAdAndWaitStart,
      isInResultPresentation,
      isWaitingForResult,
      stopAdSession,
    ]),

    onAdStatus: useCallback(
      async (data: { isPlaying?: boolean; isAdPlaying?: boolean; adStartedAt?: number }) => {
        const playing = Boolean(data.isAdPlaying ?? data.isPlaying);
        rememberAdStartedAt(data.adStartedAt);
        if (playing) {
          if (skipDismissedAdSession(selectedMatch?.id, data.adStartedAt)) return;
          if (
            resultShownRef.current ||
            adSessionActiveRef.current ||
            isWaitingForResult() ||
            isInResultPresentation()
          ) {
            pendingInterstitialRef.current = true;
            return;
          }
          await runInterstitialSession(selectedMatch?.id, data.adStartedAt);
          return;
        }
        if (!adSessionActiveRef.current && screenPhaseRef.current !== "ad_playing") return;
        if (predictionEnabledRef.current || screenPhaseRef.current === "picking") {
          adSessionActiveRef.current = false;
          stopAdSession();
          setShowAdOverlay(false);
          pendingInterstitialRef.current = false;
          return;
        }
        await grantRewardIfWatchedUntilOperatorStop(selectedMatch?.id);
        finishAdAndWaitStart();
      },
      [
        isWaitingForResult,
        isInResultPresentation,
        runInterstitialSession,
        selectedMatch?.id,
        grantRewardIfWatchedUntilOperatorStop,
        finishAdAndWaitStart,
        stopAdSession,
        rememberAdStartedAt,
        skipDismissedAdSession,
      ],
    ),

    onScoreboardUpdate: useCallback((data: { scoreboard?: LiveScoreboard }) => {
      if (data?.scoreboard) onScoreboardRef.current?.(data.scoreboard);
    }, []),

    onPinchHitterSet: useCallback(() => {
      void speakGameVoice("user.pinchHitter", 4_000);
      if (selectedMatch?.id) {
        queryClient.invalidateQueries({
          queryKey: ["/api/matches", selectedMatch.id, "scoreboard"],
        });
      }
    }, [selectedMatch?.id]),

    onPinchHitterCleared: useCallback(() => {
      if (selectedMatch?.id) {
        queryClient.invalidateQueries({
          queryKey: ["/api/matches", selectedMatch.id, "scoreboard"],
        });
      }
    }, [selectedMatch?.id]),

    onMatchEnd: useCallback(() => {
      handleMatchEnded();
    }, [handleMatchEnded]),
  };

  useMatchWebSocket({
    matchId: selectedMatch?.id ?? null,
    userId: user?.id ?? null,
    autoConnect: Boolean(selectedMatch?.id && user),
    handlers: wsHandlers,
  });

  const handleFieldSelect = useCallback(
    (option: PredictionOption) => {
      if (screenPhase !== "picking") return;
      if (!predictionEnabled) return;
      setSelectedPrediction(option);
      setShowBetModal(true);
    },
    [screenPhase, predictionEnabled],
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
      rememberActiveBet({
        round: data.roundNumber,
        prediction: selectedPrediction,
        predictionId: data.id,
        amount: selectedBetAmount,
      });
      lastResultPredictionIdRef.current = data.id;
      setLastBetAmount(selectedBetAmount);
      setUser({ ...user, points: (user.points ?? 0) - selectedBetAmount });
    } catch (error: unknown) {
      waitingResultRef.current = false;
      activeBetRef.current = null;
      betSnapshotRef.current = null;
      setScreenPhase(predictionEnabled ? "picking" : "wait_start");
      setSelectedPrediction(null);
      toast({
        description: error instanceof Error ? error.message : "예측 제출에 실패했습니다.",
        variant: "destructive",
      });
    }
  }, [user, selectedMatch, selectedPrediction, selectedBetAmount, setUser, predictionEnabled, toast, rememberActiveBet]);

  const labelsVisible = screenPhase === "picking";
  const labelsInteractive = screenPhase === "picking";
  const blinkPrediction = null;

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
    eventCountdown,
    eventSubtitle,
    showAdOverlay,
    adSessionState,
    isNativePlatform,
    labelsVisible,
    labelsInteractive,
    blinkPrediction,
    handleFieldSelect,
    handleBetNext,
    handleConfirmCancel,
    handleConfirmSubmit,
    handleRunComplete,
    handleAdOverlayDismiss,
  };
}
