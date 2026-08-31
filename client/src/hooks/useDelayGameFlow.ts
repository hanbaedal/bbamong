import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DELAY_AD_BREAK_MS,
  DELAY_AD_INTRO_MS,
  DELAY_AD_PLAY_SECONDS,
  DELAY_LIVE_BLOCK_MESSAGE,
  type DelayAdReason,
  type DelayGamePhase,
} from "@shared/delayGame";
import { DEFAULT_BET_AMOUNT, type BetAmountOption } from "@shared/predictionOdds";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import {
  RESULT_FLASH_MS,
  normalizeRoundResultLabel,
  type GameScreenPhase,
  type PredictionOption,
} from "@/components/game/gameTypes";

export type DelayMyPrediction = {
  roundNumber: number;
  prediction: string;
  amount: number;
  status: string;
  result: string | null;
  wonAmount: number;
};

export type DelayStatePayload = {
  phase: DelayGamePhase;
  roundNumber: number;
  batterName: string | null;
  settledResult: PredictionOption | null;
  pendingResult: PredictionOption | null;
  openAtMs: number | null;
  adUntilMs: number | null;
  adReason: DelayAdReason | null;
  adRewardKey: string | null;
};

export function mapDelayServerPhase(
  phase: DelayGamePhase | null | undefined,
  now: number,
  adUntilMs: number | null,
  adReason: DelayAdReason | null,
  dismissedAdKey: string | null,
  adRewardKey: string | null,
): {
  screenPhase: GameScreenPhase;
  eventCountdown: number | null;
  showAdOverlay: boolean;
} {
  if (phase === "ended") {
    return { screenPhase: "match_ended", eventCountdown: null, showAdOverlay: false };
  }
  if (phase === "open") {
    return { screenPhase: "picking", eventCountdown: null, showAdOverlay: false };
  }
  if (phase === "closed") {
    return { screenPhase: "wait_result", eventCountdown: null, showAdOverlay: false };
  }
  if (phase === "ad" && adUntilMs) {
    if (dismissedAdKey && dismissedAdKey === adRewardKey) {
      return { screenPhase: "wait_start", eventCountdown: null, showAdOverlay: false };
    }
    const remaining = adUntilMs - now;
    const elapsed = DELAY_AD_BREAK_MS - remaining;
    if (elapsed < DELAY_AD_INTRO_MS) {
      const eventCountdown = Math.max(1, Math.ceil((DELAY_AD_INTRO_MS - elapsed) / 1000));
      return {
        screenPhase: adReason === "pitcher_change" ? "pitcher_change_event" : "inning_switch_event",
        eventCountdown,
        showAdOverlay: false,
      };
    }
    return { screenPhase: "ad_playing", eventCountdown: null, showAdOverlay: true };
  }
  return { screenPhase: "wait_start", eventCountdown: null, showAdOverlay: false };
}

export function useDelayGameFlow(input: {
  matchId: string | null;
  delay: DelayStatePayload | null;
  myPrediction: DelayMyPrediction | null;
  blocked: boolean;
  serverNow: number | null;
}) {
  const { matchId, delay, myPrediction, blocked, serverNow } = input;
  const { toast } = useToast();
  const { refetchUser } = useUser();
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionOption | null>(null);
  const [showBetModal, setShowBetModal] = useState(false);
  const [selectedBetAmount, setSelectedBetAmount] = useState<BetAmountOption>(DEFAULT_BET_AMOUNT);
  const [lastWonAmount, setLastWonAmount] = useState(0);
  const [lastBetAmount, setLastBetAmount] = useState(0);
  const [localPhase, setLocalPhase] = useState<GameScreenPhase | null>(null);
  const [roundResultLabel, setRoundResultLabel] = useState<string | null>(null);
  const [dismissedAdKey, setDismissedAdKey] = useState<string | null>(null);
  const flashedRoundRef = useRef<number>(0);
  const rewardedAdKeyRef = useRef<string | null>(null);
  const submittingRef = useRef(false);

  const now = serverNow ?? Date.now();

  useEffect(() => {
    setSelectedPrediction(null);
    setShowBetModal(false);
    setLocalPhase(null);
    setRoundResultLabel(null);
    setDismissedAdKey(null);
    flashedRoundRef.current = 0;
    rewardedAdKeyRef.current = null;
  }, [matchId]);

  useEffect(() => {
    if (myPrediction?.status === "pending" && isDelaySuggestedResultLocal(myPrediction.prediction)) {
      setSelectedPrediction(myPrediction.prediction);
      setLastBetAmount(myPrediction.amount);
    }
  }, [myPrediction?.status, myPrediction?.prediction, myPrediction?.amount, myPrediction?.roundNumber]);

  useEffect(() => {
    if (!delay) return;
    if (delay.phase !== "idle" && delay.phase !== "ad") return;
    const round = delay.roundNumber;
    if (round <= 0 || flashedRoundRef.current === round) return;
    const settled = normalizeRoundResultLabel(delay.settledResult);
    const refunded = myPrediction?.roundNumber === round && myPrediction.status === "refunded";
    if (!settled && !refunded) return;
    flashedRoundRef.current = round;
    if (refunded) {
      toast({ description: "결과가 확정되지 않아 딜레이 예측 포인트가 환불되었습니다.", duration: 4000 });
      void refetchUser();
      setSelectedPrediction(null);
      setLocalPhase(null);
      return;
    }
    setRoundResultLabel(settled);
    setLocalPhase("result_flash");
    const won = myPrediction?.roundNumber === round && myPrediction.status === "won";
    if (won) {
      setLastWonAmount(myPrediction.wonAmount ?? 0);
      setLastBetAmount(myPrediction.amount);
    } else if (myPrediction?.roundNumber === round && myPrediction.status === "lost") {
      setLastWonAmount(0);
      setLastBetAmount(myPrediction.amount);
    }
    const timer = window.setTimeout(() => {
      if (won) {
        setLocalPhase("success_running");
      } else {
        setLocalPhase(null);
        setSelectedPrediction(null);
      }
      void refetchUser();
    }, RESULT_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [
    delay?.phase,
    delay?.roundNumber,
    delay?.settledResult,
    myPrediction?.roundNumber,
    myPrediction?.status,
    myPrediction?.wonAmount,
    myPrediction?.amount,
    toast,
    refetchUser,
  ]);

  const mapped = useMemo(
    () =>
      mapDelayServerPhase(
        delay?.phase,
        now,
        delay?.adUntilMs ?? null,
        delay?.adReason ?? null,
        dismissedAdKey,
        delay?.adRewardKey ?? null,
      ),
    [delay?.phase, delay?.adUntilMs, delay?.adReason, delay?.adRewardKey, dismissedAdKey, now],
  );

  const presenting = localPhase === "result_flash" || localPhase === "success_running";
  const screenPhase: GameScreenPhase = presenting ? localPhase! : mapped.screenPhase;
  const showAdOverlay = presenting ? false : mapped.showAdOverlay;
  const eventCountdown = presenting ? null : mapped.eventCountdown;

  const labelsVisible = screenPhase === "picking" && !blocked;
  const labelsInteractive = labelsVisible;

  const handleFieldSelect = useCallback(
    (option: PredictionOption) => {
      if (blocked) {
        toast({ description: DELAY_LIVE_BLOCK_MESSAGE, duration: 4000 });
        return;
      }
      if (screenPhase !== "picking") return;
      setSelectedPrediction(option);
      setShowBetModal(true);
    },
    [blocked, screenPhase, toast],
  );

  const handleBetModalCancel = useCallback(() => {
    setShowBetModal(false);
    setSelectedPrediction(null);
  }, []);

  const handleBetSubmit = useCallback(async () => {
    if (!matchId || !selectedPrediction || submittingRef.current) return;
    if (blocked) {
      setShowBetModal(false);
      toast({ description: DELAY_LIVE_BLOCK_MESSAGE, duration: 4000 });
      return;
    }
    submittingRef.current = true;
    setShowBetModal(false);
    setLastBetAmount(selectedBetAmount);
    try {
      const res = await apiRequest("POST", `/api/delay-game/${matchId}/predictions`, {
        prediction: selectedPrediction,
        amount: selectedBetAmount,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "예측에 실패했습니다.");
      }
      void refetchUser();
    } catch (error) {
      setSelectedPrediction(null);
      toast({
        description: error instanceof Error ? error.message : "예측에 실패했습니다.",
        duration: 4000,
      });
    } finally {
      submittingRef.current = false;
    }
  }, [matchId, selectedPrediction, selectedBetAmount, blocked, refetchUser, toast]);

  const handleRunComplete = useCallback(() => {
    setLocalPhase(null);
    setSelectedPrediction(null);
  }, []);

  const handleAdOverlayDismiss = useCallback(() => {
    if (delay?.adRewardKey) setDismissedAdKey(delay.adRewardKey);
  }, [delay?.adRewardKey]);

  const handleAdOverlayComplete = useCallback(() => {
    const key = delay?.adRewardKey;
    if (!matchId || !key) return;
    if (rewardedAdKeyRef.current === key) return;
    rewardedAdKeyRef.current = key;
    void (async () => {
      try {
        const res = await apiRequest("POST", `/api/delay-game/${matchId}/ad-complete`, {
          rewardKey: key,
        });
        if (!res.ok) return;
        void refetchUser();
      } catch {
        rewardedAdKeyRef.current = null;
      }
    })();
  }, [matchId, delay?.adRewardKey, refetchUser]);

  return {
    screenPhase,
    selectedPrediction,
    roundResultLabel,
    labelsVisible,
    labelsInteractive,
    blinkPrediction: null as PredictionOption | null,
    showBetModal,
    selectedBetAmount,
    setSelectedBetAmount,
    lastWonAmount,
    lastBetAmount,
    resultCountdown: null as number | null,
    eventCountdown,
    eventSubtitle: delay?.adReason === "switch_half" ? "수비와 공격이 바뀝니다" : undefined,
    showAdOverlay,
    adOverlayMessage: "광고가 재생 중입니다...",
    adOverlayDismissible: true,
    adOverlayCompleteAfterSeconds: DELAY_AD_PLAY_SECONDS,
    handleFieldSelect,
    handleBetModalCancel,
    handleBetSubmit,
    handleRunComplete,
    handleAdOverlayDismiss,
    handleAdOverlayComplete,
  };
}

function isDelaySuggestedResultLocal(value: string): value is PredictionOption {
  return value === "아웃" || value === "1루" || value === "2루" || value === "3루" || value === "홈런";
}
