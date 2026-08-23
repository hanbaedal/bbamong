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
import { GAME_EVENT_SHOW_MS, MATCH_ENDED_SHOW_MS, RESULT_FLASH_MS, CATCHUP_RESULT_MS, isOutcomePresentationPhase, isTransientAdOrEventPhase, isPageHidden, normalizeRoundResultLabel } from "@/components/game/gameTypes";
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
import type { AtBatPhase } from "@shared/atBatPhase";

export interface MatchFlowData {
  id: string;
  name: string;
  stadiumName: string;
  startTime: string;
  matchStatus: string;
  predictionEnabled?: boolean;
  currentRound?: number;
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

export function useLandscapePredictionFlow(
  selectedMatch: MatchFlowData | null,
  options?: {
    onScoreboardUpdate?: (scoreboard: LiveScoreboard) => void;
    onGamePhaseUpdate?: (phase: unknown) => void;
    onMatchEnded?: () => void;
  },
) {
  const { user, setUser, refetchUser } = useUser();
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
  const [predictionResult, setPredictionResult] = useState<PredictionResult>("pending");
  const [roundResultLabel, setRoundResultLabel] = useState<PredictionOption | null>(null);
  const [lastWonAmount, setLastWonAmount] = useState(0);
  const [lastBetAmount, setLastBetAmount] = useState(0);
  const [resultCountdown, setResultCountdown] = useState<number | null>(null);
  const [eventCountdown, setEventCountdown] = useState<number | null>(null);
  const [eventSubtitle, setEventSubtitle] = useState("");
  const [showAdOverlay, setShowAdOverlay] = useState(false);
  const [adOverlayMessage, setAdOverlayMessage] = useState<string | undefined>();
  const [adOverlayDismissible, setAdOverlayDismissible] = useState(true);
  /** 제출 후·예측 중지 전 — 베이스는 보이되 추가 선택은 잠금 */
  const [betLocked, setBetLocked] = useState(false);

  const activeBetRef = useRef<ActiveBet | null>(null);
  /** activeBet이 비워져도 round_result 연출용으로 유지 */
  const betSnapshotRef = useRef<ActiveBet | null>(null);
  const waitingResultRef = useRef(false);
  /** 결과 대기 중인 라운드 — 미참여도 /check 가 wait_result 를 깨지 않게 */
  const awaitingResultRoundRef = useRef<number | null>(null);
  const resultShownRef = useRef(false);
  const lastResultPredictionIdRef = useRef<number | null>(null);
  const acknowledgedResultIdRef = useRef<number | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishResultPresentationRef = useRef<(() => void) | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventCountdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingRewardKeyRef = useRef<string | null>(null);
  const adSessionActiveRef = useRef(false);
  const adDismissedEarlyRef = useRef(false);
  const rewardedVideoCompletedRef = useRef(false);
  const adStartedAtRef = useRef<number | null>(null);
  const matchEndedRef = useRef(false);
  const failVoiceSpokenRef = useRef(false);
  const matchEndedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const predictionEnabledRef = useRef(false);
  const screenPhaseRef = useRef<GameScreenPhase>("wait_start");
  /** 예측 시작/중지마다 증가 — 클릭·모달 레이스로 잔상 UI가 남지 않게 함 */
  const predictionEpochRef = useRef(0);
  const pendingRoundNextRef = useRef<PendingRoundNext | null>(null);
  /** 결과 연출 중 도착한 전면광고 — 연출/교체 이벤트 후 재생 */
  const pendingInterstitialRef = useRef(false);
  /** 결과 연출 중에 prediction_started가 온 경우, 연출 종료 후 picking으로 */
  const wantPickingAfterResultRef = useRef(false);
  /** 자리비움·다음 타석 대기 중 결과 연출은 주루를 생략하고 짧게 */
  const hurryResultRef = useRef(false);
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

  const bumpPredictionEpoch = useCallback(() => {
    predictionEpochRef.current += 1;
  }, []);

  /** 예측 창 닫기 — 모달·선택 잔상 제거 (중지/취소/폴링 demote 공통) */
  const closePickingUi = useCallback((opts?: { keepSelection?: boolean }) => {
    bumpPredictionEpoch();
    predictionEnabledRef.current = false;
    setPredictionEnabled(false);
    wantPickingAfterResultRef.current = false;
    setShowBetModal(false);
    if (!opts?.keepSelection) {
      setSelectedPrediction(null);
    }
  }, [bumpPredictionEpoch]);

  const clearResultTimers = useCallback(() => {
    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
    if (resultFlashTimerRef.current) {
      clearTimeout(resultFlashTimerRef.current);
      resultFlashTimerRef.current = null;
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
    if (hurryResultRef.current || isPageHidden()) {
      hurryResultRef.current = true;
      void speakGameVoice("user.predictionSuccess");
      // Hop 축하는 생략 — 바로 대기/다음 타석
      finishResultPresentationRef.current?.();
      return;
    }
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
    hurryResultRef.current = false;
    resultShownRef.current = false;
    waitingResultRef.current = false;
    awaitingResultRoundRef.current = null;
    activeBetRef.current = null;
    betSnapshotRef.current = null;
    setBetLocked(false);
    setSelectedPrediction(null);
    setPredictionResult("pending");
    setRoundResultLabel(null);
    setShowBetModal(false);
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
    predictionEpochRef.current += 1;
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
    rewardedVideoCompletedRef.current = false;
    setAdOverlayMessage(undefined);
    setAdOverlayDismissible(true);
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
      rewardedVideoCompletedRef.current = false;
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
      const eligible = isNativePlatform
        ? rewardedVideoCompletedRef.current
        : true;
      if (!eligible) return;
      await claimAdRewardIfPending(matchId);
    },
    [claimAdRewardIfPending, isNativePlatform],
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
      isOutcomePresentationPhase(phase)
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

  /**
   * 서버 at_bat_phase 권위 반영.
   * WS prediction_* 누락·HTTP 폴링 demote로 단계가 어긋나는 것을 막는다.
   */
  const applyServerAtBatPhase = useCallback(
    (phase: AtBatPhase, roundNumber?: number) => {
      if (matchEndedRef.current) return;
      if (isInResultPresentation()) return;
      const ui = screenPhaseRef.current;
      if (isTransientAdOrEventPhase(ui) && phase !== "prediction_open") return;

      if (phase === "prediction_open") {
        pendingInterstitialRef.current = false;
        adSessionActiveRef.current = false;
        stopAdSession();
        setShowAdOverlay(false);
        waitingResultRef.current = false;
        awaitingResultRoundRef.current = null;
        setBetLocked(false);
        predictionEnabledRef.current = true;
        setPredictionEnabled(true);
        if (ui !== "picking") {
          setShowBetModal(false);
          setSelectedPrediction(null);
          setScreenPhase("picking");
        }
        return;
      }

      if (phase === "prediction_closed") {
        const hadBet = Boolean(activeBetRef.current || betSnapshotRef.current);
        closePickingUi({ keepSelection: hadBet });
        waitingResultRef.current = true;
        if (typeof roundNumber === "number") {
          awaitingResultRoundRef.current = roundNumber;
        } else if (
          awaitingResultRoundRef.current == null &&
          typeof selectedMatch?.currentRound === "number"
        ) {
          awaitingResultRoundRef.current = selectedMatch.currentRound;
        }
        setBetLocked(false);
        if (ui !== "wait_result") setScreenPhase("wait_result");
        return;
      }

      if (phase === "result_confirmed") {
        // round_result 연출 전 — 결과대기 유지
        if (ui === "wait_result" || waitingResultRef.current) return;
        if (ui === "picking") {
          closePickingUi();
          waitingResultRef.current = true;
          setScreenPhase("wait_result");
        }
        return;
      }

      // idle
      if (isWaitingForResult()) return;
      if (isTransientAdOrEventPhase(ui)) return;
      predictionEnabledRef.current = false;
      setPredictionEnabled(false);
      setBetLocked(false);
      if (ui !== "wait_start" && ui !== "match_ended") {
        setScreenPhase("wait_start");
      }
    },
    [
      isInResultPresentation,
      isWaitingForResult,
      closePickingUi,
      stopAdSession,
      selectedMatch?.currentRound,
    ],
  );

  const rememberActiveBet = useCallback((bet: ActiveBet) => {
    activeBetRef.current = bet;
    betSnapshotRef.current = bet;
  }, []);

  const clearResultPresentationState = useCallback(() => {
    resultShownRef.current = false;
    waitingResultRef.current = false;
    awaitingResultRoundRef.current = null;
    activeBetRef.current = null;
    betSnapshotRef.current = null;
    setSelectedPrediction(null);
    setPredictionResult("pending");
    setRoundResultLabel(null);
    setShowBetModal(false);
    setLastWonAmount(0);
    setLastBetAmount(0);
    setBetLocked(false);
  }, []);

  const runInterstitialSession = useCallback(
    async (matchId?: string, startedAt?: number | null) => {
      rememberAdStartedAt(startedAt);
      if (skipDismissedAdSession(matchId, startedAt ?? adStartedAtRef.current)) return;
      if (adSessionActiveRef.current || screenPhaseRef.current === "ad_playing") return;
      adSessionActiveRef.current = true;
      adDismissedEarlyRef.current = false;
      rewardedVideoCompletedRef.current = false;
      setAdOverlayMessage(undefined);
      setAdOverlayDismissible(true);
      setShowBetModal(false);
      setScreenPhase("ad_playing");

      if (isNativePlatform) {
        const { dismissedEarly, mode, rewardEarned } = await startAdSession();
        if (!adSessionActiveRef.current) {
          setShowAdOverlay(false);
          const keepPlay =
            predictionEnabledRef.current ||
            screenPhaseRef.current === "picking" ||
            isInResultPresentation() ||
            isWaitingForResult();
          if (!keepPlay) finishAdAndWaitStart();
          return;
        }

        if (mode === "overlay") {
          setAdOverlayMessage("광고가 재생 중입니다...");
          setAdOverlayDismissible(true);
          setShowAdOverlay(true);
          return;
        }

        if (!rewardEarned || dismissedEarly) {
          adDismissedEarlyRef.current = true;
          rewardedVideoCompletedRef.current = false;
          markAdSessionDismissed(matchId ?? selectedMatch?.id ?? "", adStartedAtRef.current);
          return;
        }

        rewardedVideoCompletedRef.current = true;
        setAdOverlayMessage("리워드 광고 시청 완료. 잠시 후 예측이 재개됩니다.");
        setAdOverlayDismissible(false);
        setShowAdOverlay(true);
        return;
      }

      setAdOverlayMessage("광고가 재생 중입니다...");
      setAdOverlayDismissible(true);
      setShowAdOverlay(true);
    },
    [
      isNativePlatform,
      startAdSession,
      finishAdAndWaitStart,
      rememberAdStartedAt,
      skipDismissedAdSession,
      selectedMatch?.id,
      isInResultPresentation,
      isWaitingForResult,
    ],
  );

  const flushPendingInterstitial = useCallback(async () => {
    if (!pendingInterstitialRef.current) return;
    // 이미 재생 중이면 플래그만 유지하지 않고 종료 (중첩 세션 방지)
    if (adSessionActiveRef.current || screenPhaseRef.current === "ad_playing") {
      pendingInterstitialRef.current = false;
      return;
    }
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
        // 서버 AD_INTRO_DELAY 와 이벤트 종료를 맞춤 — 광고는 ad_started 또는 flush 한 곳에서만
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
    hurryResultRef.current = false;
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

  finishResultPresentationRef.current = finishResultPresentation;

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

  const isNextAtBatReady = useCallback(() => {
    return (
      wantPickingAfterResultRef.current ||
      pendingRoundNextRef.current != null ||
      predictionEnabledRef.current
    );
  }, []);

  const applyHurryResultPresentation = useCallback(() => {
    hurryResultRef.current = true;
    const phase = screenPhaseRef.current;
    if (phase === "result_flash" || phase === "success_running" || phase === "success_announce") {
      if (phase === "success_running" || phase === "success_announce") {
        void speakGameVoice("user.predictionSuccess");
      }
      finishResultPresentation();
      return;
    }
    if (phase === "success_celebrate" || phase === "fail") {
      resultDismissScheduledRef.current = true;
      scheduleResultDismiss(CATCHUP_RESULT_MS);
    }
  }, [scheduleResultDismiss, finishResultPresentation]);

  /** 큰 글씨 후: 적중→주루, 빗나감/미예측→대기 */
  const continueAfterResultFlash = useCallback(
    (personal: "success" | "fail" | "spectator") => {
      if (personal === "success") {
        beginSuccessPresentation();
        return;
      }
      if (personal === "fail") {
        void speakGameVoice("user.predictionFail");
      }
      finishResultPresentation();
    },
    [beginSuccessPresentation, finishResultPresentation],
  );

  const startResultFlash = useCallback(
    (label: PredictionOption, personal: "success" | "fail" | "spectator") => {
      resultShownRef.current = true;
      waitingResultRef.current = false;
      awaitingResultRoundRef.current = null;
      setBetLocked(false);
      setRoundResultLabel(label);
      setPredictionResult(personal === "success" ? "success" : personal === "fail" ? "fail" : "pending");
      setScreenPhase("result_flash");
      if (resultFlashTimerRef.current) {
        clearTimeout(resultFlashTimerRef.current);
        resultFlashTimerRef.current = null;
      }
      const ms =
        hurryResultRef.current || isPageHidden() || wantPickingAfterResultRef.current
          ? CATCHUP_RESULT_MS
          : RESULT_FLASH_MS;
      if (isPageHidden()) hurryResultRef.current = true;
      resultFlashTimerRef.current = setTimeout(() => {
        resultFlashTimerRef.current = null;
        continueAfterResultFlash(personal);
      }, ms);
    },
    [continueAfterResultFlash],
  );

  type PredictionSnapshot = {
    hasPrediction: boolean;
    prediction?: string;
    predictionId?: number;
    roundNumber?: number;
    amount?: number;
    status?: string;
    wonAmount?: number;
    /** 없으면 predictionEnabled 상태 유지 (WS restore) */
    predictionEnabled?: boolean;
  };

  /**
   * /check · user_already_predicted 공통 적용.
   * WS·HTTP 채널은 유지하고, 화면 상태 반영만 한곳에서 한다.
   */
  const applyPredictionSnapshot = useCallback(
    (data: PredictionSnapshot) => {
      const updateEnabled = data.predictionEnabled !== undefined;
      const enabled = updateEnabled
        ? Boolean(data.predictionEnabled)
        : predictionEnabledRef.current;
      if (updateEnabled) {
        predictionEnabledRef.current = enabled;
        setPredictionEnabled(enabled);
      }

      const presenting =
        resultShownRef.current ||
        isOutcomePresentationPhase(screenPhaseRef.current);

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
          awaitingResultRoundRef.current = null;
          resultShownRef.current = false;
          setBetLocked(false);
          setSelectedPrediction(null);
          setPredictionResult("pending");
          setRoundResultLabel(null);
          setLastWonAmount(0);
          setLastBetAmount(0);
          setScreenPhase(enabled ? "picking" : "wait_start");
          return;
        }

        if (
          presenting &&
          resolvedId != null &&
          resolvedId === lastResultPredictionIdRef.current
        ) {
          return;
        }
        if (presenting && isResolved) return;

        waitingResultRef.current = true;
        if (typeof data.roundNumber === "number") {
          awaitingResultRoundRef.current = data.roundNumber;
        }
        setSelectedPrediction((data.prediction as PredictionOption) ?? null);
        setLastBetAmount(data.amount ?? DEFAULT_BET_AMOUNT);

        if (isResolved) {
          if (resolvedId != null) lastResultPredictionIdRef.current = resolvedId;
          resultShownRef.current = true;
          setPredictionResult(data.status as PredictionResult);
          setLastWonAmount(data.wonAmount ?? 0);
          const label =
            normalizeRoundResultLabel(data.prediction) ??
            (data.prediction as PredictionOption | undefined) ??
            null;
          // /check 는 실제 라운드 결과 필드가 없어, 성공 시 본인 예측(=결과)로 큰 글씨
          if (label && data.status === "success") {
            startResultFlash(label, "success");
          } else if (data.status === "fail") {
            // 실패 시 실제 결과 모름 → 큰 글씨 없이 대기로 (따라잡기)
            setPredictionResult("fail");
            void speakGameVoice("user.predictionFail");
            finishResultPresentation();
          } else if (data.status === "success") {
            beginSuccessPresentation();
          } else {
            finishResultPresentation();
          }
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

      if (presenting) return;

      // 결과 대기 중 /check 가 hasPrediction:false 로 미참여·제출자 모두 wait_start 로 내리지 않음
      const awaitRound =
        awaitingResultRoundRef.current ??
        activeBetRef.current?.round ??
        betSnapshotRef.current?.round ??
        null;
      const stillAwaitingResult =
        waitingResultRef.current || screenPhaseRef.current === "wait_result";
      if (stillAwaitingResult) {
        if (
          typeof awaitRound === "number" &&
          typeof data.roundNumber === "number" &&
          awaitRound !== data.roundNumber
        ) {
          // 라운드가 바뀌었고 현재 라운드에 예측 없음 → 결과대기 해제 (복귀 가드)
        } else {
          return;
        }
      }

      waitingResultRef.current = false;
      awaitingResultRoundRef.current = null;
      activeBetRef.current = null;
      betSnapshotRef.current = null;
      setBetLocked(false);
      setSelectedPrediction(null);
      setPredictionResult("pending");
      setLastWonAmount(0);
      setLastBetAmount(0);
      void refetchUser();
      if (isTransientAdOrEventPhase(screenPhaseRef.current)) return;
      setScreenPhase(enabled ? "picking" : "wait_start");
    },
    [rememberActiveBet, beginSuccessPresentation, startResultFlash, finishResultPresentation, selectedMatch?.id, refetchUser],
  );

  const checkPredictionStatus = useCallback(async () => {
    if (!selectedMatch?.id) return;
    try {
      const res = await apiRequest("GET", `/api/live-match/predictions/${selectedMatch.id}/check`);
      if (!res.ok) return;
      const data = await res.json();
      applyPredictionSnapshot({
        hasPrediction: Boolean(data.hasPrediction),
        prediction: data.prediction,
        predictionId: data.predictionId,
        roundNumber: data.roundNumber,
        amount: data.amount,
        status: data.status,
        wonAmount: data.wonAmount,
        predictionEnabled: data.predictionEnabled,
      });
    } catch {
      /* ignore */
    }
  }, [selectedMatch?.id, applyPredictionSnapshot]);

  const checkPredictionStatusRef = useRef(checkPredictionStatus);
  checkPredictionStatusRef.current = checkPredictionStatus;

  const syncMatchFromServer = useCallback(async () => {
    if (!selectedMatch?.id) return;
    if (!shouldClientPollMatch(selectedMatch.startTime, selectedMatch.matchStatus)) return;
    try {
      const res = await apiRequest("GET", `/api/matches/${selectedMatch.id}`);
      if (!res.ok) return;
      const matchData = await res.json();

      // prediction.tsx 전용 폴링과 통합 — 동일 GET으로 gamePhase도 반영
      onGamePhaseRef.current?.(matchData.gamePhase ?? matchData);

      if (matchData.matchStatus === "completed" || matchData.matchStatus === "cancelled") {
        handleMatchEnded();
        return;
      }

      // 결과 연출 중에는 predictionEnabled promote/demote 만 보류
      if (resultShownRef.current) return;

      const enabled = Boolean(matchData.predictionEnabled);
      predictionEnabledRef.current = enabled;
      setPredictionEnabled(enabled);

      const serverPhase = matchData.atBatPhase;
      if (
        serverPhase === "idle" ||
        serverPhase === "prediction_open" ||
        serverPhase === "prediction_closed" ||
        serverPhase === "result_confirmed"
      ) {
        applyServerAtBatPhase(
          serverPhase,
          typeof matchData.currentRound === "number" ? matchData.currentRound : undefined,
        );
        return;
      }

      if (
        enabled &&
        screenPhaseRef.current === "wait_start" &&
        !waitingResultRef.current
      ) {
        setScreenPhase("picking");
        return;
      }

      // WS 누락 폴백 — 중지면 결과대기(뒷모습), 시작 전 대기가 아님
      if (!enabled && screenPhaseRef.current === "picking") {
        applyServerAtBatPhase(
          "prediction_closed",
          typeof matchData.currentRound === "number" ? matchData.currentRound : undefined,
        );
      }
    } catch {
      /* ignore */
    }
  }, [
    selectedMatch?.id,
    selectedMatch?.startTime,
    selectedMatch?.matchStatus,
    handleMatchEnded,
    applyServerAtBatPhase,
  ]);

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
      void refetchUser();
      if (isInResultPresentation() && isNextAtBatReady()) {
        finishResultPresentation();
      }
      void checkPredictionStatusRef.current();
      void syncMatchFromServerRef.current();
    });
  }, [selectedMatch?.id, refetchUser, finishResultPresentation, isInResultPresentation, isNextAtBatReady]);

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
    // 제출한 예측 복구용 — 미참여 wait_result 는 /check 로 깨지므로 폴링하지 않음
    if (screenPhase !== "wait_result" || predictionResult !== "pending" || !selectedMatch?.id) return;
    if (!activeBetRef.current && !betSnapshotRef.current) return;

    const id = setInterval(() => {
      void checkPredictionStatusRef.current();
    }, 2000);

    return () => clearInterval(id);
  }, [screenPhase, predictionResult, selectedMatch?.id]);

  const handleRunComplete = useCallback(() => {
    void speakGameVoice("user.predictionSuccess");
    // 방방 뛰기(success_celebrate) 생략 → 바로 대기/다음 타석
    finishResultPresentation();
  }, [finishResultPresentation]);

  useEffect(() => {
    if (
      screenPhase === "picking" ||
      screenPhase === "wait_start" ||
      screenPhase === "wait_result"
    ) {
      failVoiceSpokenRef.current = false;
    }
  }, [screenPhase]);

  // 레거시 fail/celebrate 안전망 (정상 경로는 result_flash → 주루/대기)
  useEffect(() => {
    if (screenPhase !== "success_celebrate" && screenPhase !== "fail") {
      resultDismissScheduledRef.current = false;
      return;
    }
    if (resultDismissScheduledRef.current) return;
    resultDismissScheduledRef.current = true;
    const hurry = hurryResultRef.current || isPageHidden() || wantPickingAfterResultRef.current;
    if (isPageHidden()) hurryResultRef.current = true;
    scheduleResultDismiss(hurry ? CATCHUP_RESULT_MS : CATCHUP_RESULT_MS);
  }, [screenPhase, scheduleResultDismiss]);

  const handleRoundResult = useCallback(
    (data: { result?: string; wonAmount?: number }) => {
      if (resultShownRef.current) return;

      const outcome = normalizeRoundResultLabel(data.result);
      if (!outcome) {
        if (isWaitingForResult()) {
          void checkPredictionStatus();
        }
        return;
      }

      const bet = activeBetRef.current ?? betSnapshotRef.current;
      if (bet?.predictionId) lastResultPredictionIdRef.current = bet.predictionId;

      const personal: "success" | "fail" | "spectator" = !bet
        ? "spectator"
        : data.result === bet.prediction || outcome === bet.prediction
          ? "success"
          : "fail";

      resultShownRef.current = true;
      waitingResultRef.current = false;
      awaitingResultRoundRef.current = null;
      setBetLocked(false);
      setLastWonAmount(data.wonAmount ?? 0);
      if (bet) {
        setLastBetAmount(bet.amount);
        setSelectedPrediction(bet.prediction);
      }
      activeBetRef.current = null;

      if (personal === "success" && user && bet) {
        const won = data.wonAmount ?? calculateFixedOddsPayout(bet.amount, bet.prediction);
        setLastWonAmount(won);
        void refetchUser();
      }

      startResultFlash(outcome, personal);
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    },
    [user, isWaitingForResult, checkPredictionStatus, startResultFlash, refetchUser],
  );

  const enterAdSessionFromServer = useCallback(
    async (opts: {
      matchId?: string;
      adStartedAt?: number;
      /** ad_status 재연결 시 이미 재생 중이면 보류만 */
      deferIfAlreadyActive?: boolean;
    }) => {
      rememberAdStartedAt(opts.adStartedAt);
      const matchId = opts.matchId ?? selectedMatch?.id;
      if (skipDismissedAdSession(matchId, opts.adStartedAt)) return;
      const phase = screenPhaseRef.current;
      const duringSwitchOrPitcher =
        phase === "inning_switch_event" || phase === "pitcher_change_event";
      if (
        resultShownRef.current ||
        (opts.deferIfAlreadyActive && adSessionActiveRef.current) ||
        isWaitingForResult() ||
        isInResultPresentation() ||
        duringSwitchOrPitcher
      ) {
        pendingInterstitialRef.current = true;
        return;
      }
      await runInterstitialSession(matchId, opts.adStartedAt);
    },
    [
      rememberAdStartedAt,
      skipDismissedAdSession,
      selectedMatch?.id,
      isWaitingForResult,
      isInResultPresentation,
      runInterstitialSession,
    ],
  );

  const exitAdSession = useCallback(
    async (data?: { reason?: string }) => {
      const reason = data?.reason;
      const fromPredictionStart = reason === "prediction_start";
      const fromRoundAdvance = reason === "round_advance";
      // reason 없음 = ad_status(false) 재연결 캐치업
      const fromStatusCatchUp = reason == null;

      if (fromStatusCatchUp) {
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
        return;
      }

      if (fromPredictionStart || fromRoundAdvance) {
        pendingRewardKeyRef.current = null;
      } else {
        await grantRewardIfWatchedUntilOperatorStop(selectedMatch?.id);
      }

      adSessionActiveRef.current = false;
      rewardedVideoCompletedRef.current = false;
      setAdOverlayMessage(undefined);
      setAdOverlayDismissible(true);
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
    },
    [
      grantRewardIfWatchedUntilOperatorStop,
      selectedMatch?.id,
      finishAdAndWaitStart,
      isInResultPresentation,
      isWaitingForResult,
      stopAdSession,
    ],
  );

  const wsHandlers: WSEventHandlers = {
    onConnected: useCallback((data: {
      predictionEnabled?: boolean;
      atBatPhase?: string;
      currentRound?: number;
    }) => {
      if (data.predictionEnabled !== undefined) {
        setPredictionEnabled(data.predictionEnabled);
        const phase = screenPhaseRef.current;
        if (
          !resultShownRef.current &&
          !waitingResultRef.current &&
          !isTransientAdOrEventPhase(phase) &&
          !isOutcomePresentationPhase(phase) &&
          phase !== "wait_result" &&
          phase !== "match_ended" &&
          !data.atBatPhase
        ) {
          setScreenPhase(data.predictionEnabled ? "picking" : "wait_start");
        }
      }
      const atBat = data.atBatPhase;
      if (
        atBat === "idle" ||
        atBat === "prediction_open" ||
        atBat === "prediction_closed" ||
        atBat === "result_confirmed"
      ) {
        applyServerAtBatPhase(atBat, data.currentRound);
      }
      // 전화·SNS 복귀 재연결 시 놓친 결과/타석을 /check 로 맞춤
      void checkPredictionStatus();
    }, [checkPredictionStatus, applyServerAtBatPhase]),

    onPredictionStarted: useCallback(() => {
      const key = consumeFirstPredictionOpen(selectedMatch?.id)
        ? "user.predictionOpenFirst"
        : "user.predictionOpen";
      void speakGameVoice(key);
      bumpPredictionEpoch();
      // 예측 시작 = 광고 중지 (보상 없음)
      pendingInterstitialRef.current = false;
      adSessionActiveRef.current = false;
      stopAdSession();
      setShowAdOverlay(false);
      setShowBetModal(false);

      // 결과 연출 중이면 끊지 않고, 끝난 뒤 picking으로 이어감
      if (isInResultPresentation()) {
        predictionEnabledRef.current = true;
        setPredictionEnabled(true);
        wantPickingAfterResultRef.current = true;
        if (pendingRoundNextRef.current) {
          pendingRoundNextRef.current = {
            ...pendingRoundNextRef.current,
            predictionEnabled: true,
          };
        }
        if (isPageHidden()) applyHurryResultPresentation();
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
      waitingResultRef.current = false;
      awaitingResultRoundRef.current = null;
      setBetLocked(false);
      predictionEnabledRef.current = true;
      setPredictionEnabled(true);
      setSelectedPrediction(null);
      setScreenPhase("picking");
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    }, [
      isInResultPresentation,
      stopAdSession,
      clearResultPresentationState,
      toast,
      selectedMatch?.id,
      applyHurryResultPresentation,
      bumpPredictionEpoch,
    ]),

    onPredictionEnded: useCallback(() => {
      void speakGameVoice("user.predictionClose");
      if (isInResultPresentation()) {
        closePickingUi({ keepSelection: true });
        if (pendingRoundNextRef.current) {
          pendingRoundNextRef.current = {
            ...pendingRoundNextRef.current,
            predictionEnabled: false,
          };
        }
        return;
      }
      // 미예측 회원 포함 — 전원 3번(결과 대기) 화면으로
      const hadBet = Boolean(waitingResultRef.current || activeBetRef.current);
      closePickingUi({ keepSelection: hadBet });
      waitingResultRef.current = true;
      const round =
        activeBetRef.current?.round ??
        betSnapshotRef.current?.round ??
        (typeof selectedMatch?.currentRound === "number" ? selectedMatch.currentRound : null);
      awaitingResultRoundRef.current = round;
      setBetLocked(false);
      setScreenPhase("wait_result");
    }, [isInResultPresentation, closePickingUi, selectedMatch?.currentRound]),

    onUserAlreadyPredicted: useCallback(
      (data: {
        prediction: string;
        predictionId?: number;
        round?: number;
        amount?: number;
        status?: string;
        wonAmount?: number;
      }) => {
        applyPredictionSnapshot({
          hasPrediction: true,
          prediction: data.prediction,
          predictionId: data.predictionId,
          roundNumber: data.round,
          amount: data.amount,
          status: data.status,
          wonAmount: data.wonAmount,
        });
      },
      [applyPredictionSnapshot],
    ),

    onPredictionCancelled: useCallback(
      (data: { message?: string }) => {
        // 시작 취소(1초) — 환불됨. 대기/연출 중이면 끊지 않고 안내만 (연출 보호)
        if (isInResultPresentation()) {
          closePickingUi();
          toast({
            description: data.message ?? "예측 시작이 취소되었습니다.",
            duration: 3500,
          });
          return;
        }
        const hadBet = isWaitingForResult();
        clearResultPresentationState();
        pendingRoundNextRef.current = null;
        closePickingUi();
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
      [clearResultPresentationState, isInResultPresentation, isWaitingForResult, toast, closePickingUi],
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
        screenPhaseRef.current === "result_flash" ||
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
        await enterAdSessionFromServer({
          matchId: data?.matchId,
          adStartedAt: data?.adStartedAt,
        });
      },
      [enterAdSessionFromServer],
    ),

    onAdStopped: useCallback(
      (data?: { reason?: string }) => {
        void exitAdSession(data);
      },
      [exitAdSession],
    ),

    onAdStatus: useCallback(
      async (data: { isPlaying?: boolean; isAdPlaying?: boolean; adStartedAt?: number }) => {
        const playing = Boolean(data.isAdPlaying ?? data.isPlaying);
        if (playing) {
          await enterAdSessionFromServer({
            matchId: selectedMatch?.id,
            adStartedAt: data.adStartedAt,
            deferIfAlreadyActive: true,
          });
          return;
        }
        await exitAdSession();
      },
      [enterAdSessionFromServer, exitAdSession, selectedMatch?.id],
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

    onAtBatPhase: useCallback(
      (data: { phase?: string; currentRound?: number; roundNumber?: number }) => {
        const phase = data?.phase;
        if (
          phase !== "idle" &&
          phase !== "prediction_open" &&
          phase !== "prediction_closed" &&
          phase !== "result_confirmed"
        ) {
          return;
        }
        const round =
          typeof data.currentRound === "number"
            ? data.currentRound
            : typeof data.roundNumber === "number"
              ? data.roundNumber
              : undefined;
        applyServerAtBatPhase(phase, round);
      },
      [applyServerAtBatPhase],
    ),

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

  const handleFieldSelect = useCallback((option: PredictionOption) => {
    // 클로저 state 대신 ref — 예측 중지와 클릭 레이스 방지
    if (screenPhaseRef.current !== "picking") return;
    if (!predictionEnabledRef.current) return;
    const epoch = predictionEpochRef.current;
    setSelectedPrediction(option);
    if (
      predictionEpochRef.current !== epoch ||
      screenPhaseRef.current !== "picking" ||
      !predictionEnabledRef.current
    ) {
      setSelectedPrediction(null);
      setShowBetModal(false);
      return;
    }
    setShowBetModal(true);
  }, []);

  const handleBetModalCancel = useCallback(() => {
    setShowBetModal(false);
    setSelectedPrediction(null);
  }, []);

  const handleBetSubmit = useCallback(async () => {
    if (!user || !selectedMatch || !selectedPrediction) return;
    if (screenPhaseRef.current !== "picking" || !predictionEnabledRef.current) {
      setShowBetModal(false);
      setSelectedPrediction(null);
      return;
    }
    if (betLocked) return;
    const epoch = predictionEpochRef.current;

    setShowBetModal(false);
    // 제출 후에도 예측 창(베이스)은 유지 — 중지 시에만 전원 wait_result
    waitingResultRef.current = true;
    setBetLocked(true);
    acknowledgedResultIdRef.current = null;
    lastResultPredictionIdRef.current = null;

    try {
      if (predictionEpochRef.current !== epoch || !predictionEnabledRef.current) {
        waitingResultRef.current = false;
        awaitingResultRoundRef.current = null;
        setBetLocked(false);
        setSelectedPrediction(null);
        setScreenPhase("wait_start");
        return;
      }
      const res = await apiRequest("POST", "/api/live-match/predictions", {
        matchId: selectedMatch.id,
        prediction: selectedPrediction,
        amount: selectedBetAmount,
      });
      const data = await res.json().catch(() => ({} as { roundNumber?: number; id?: number; error?: string }));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "예측 제출에 실패했습니다. 잠시 후 다시 시도해주세요.",
        );
      }
      rememberActiveBet({
        round: data.roundNumber,
        prediction: selectedPrediction,
        predictionId: data.id,
        amount: selectedBetAmount,
      });
      if (typeof data.roundNumber === "number") {
        awaitingResultRoundRef.current = data.roundNumber;
      }
      lastResultPredictionIdRef.current = data.id;
      setLastBetAmount(selectedBetAmount);
      setUser({ ...user, points: (user.points ?? 0) - selectedBetAmount });
    } catch (error: unknown) {
      waitingResultRef.current = false;
      awaitingResultRoundRef.current = null;
      activeBetRef.current = null;
      betSnapshotRef.current = null;
      setBetLocked(false);
      setSelectedPrediction(null);
      setScreenPhase(predictionEnabledRef.current ? "picking" : "wait_start");
      toast({
        description: error instanceof Error ? error.message : "예측 제출에 실패했습니다.",
        variant: "destructive",
      });
    }
  }, [user, selectedMatch, selectedPrediction, selectedBetAmount, setUser, toast, rememberActiveBet, betLocked]);

  const labelsVisible = screenPhase === "picking" && predictionEnabled;
  const labelsInteractive = screenPhase === "picking" && predictionEnabled && !betLocked;
  const blinkPrediction = null;

  return {
    screenPhase,
    predictionEnabled,
    selectedPrediction,
    selectedBetAmount,
    setSelectedBetAmount,
    showBetModal,
    setShowBetModal,
    predictionResult,
    roundResultLabel,
    lastWonAmount,
    lastBetAmount,
    resultCountdown,
    eventCountdown,
    eventSubtitle,
    showAdOverlay,
    adOverlayMessage,
    adOverlayDismissible,
    adSessionState,
    isNativePlatform,
    labelsVisible,
    labelsInteractive,
    blinkPrediction,
    handleFieldSelect,
    handleBetModalCancel,
    handleBetSubmit,
    handleRunComplete,
    handleAdOverlayDismiss,
  };
}
