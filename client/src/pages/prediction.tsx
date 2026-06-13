import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import ConfirmPopup from "@/components/customUi/confirmPopup";
import LoadingOverlay from "@/components/customUi/LoadingOverlay";
import DonationPopup from "@/components/customUi/donationPopup";
import SimpleInfoPopup from "@/components/customUi/simpleInfoPopup";
import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { useUser } from "@/contexts/UserContext";
import { useUserAssets } from "@/contexts/UserAssetContext";
import { apiRequest, queryClient, getFullUrl } from "@/lib/queryClient";
import { getAccessToken } from "@/lib/tokenManager";
import { useToast } from "@/hooks/use-toast";
import { useAdMob } from "@/hooks/useAdMob";
import { useMatchWebSocket, WSEventHandlers } from "@/hooks/useMatchWebSocket";
type PredictionOption = "1루" | "2루" | "3루" | "홈런" | "아웃";

interface MatchData {
  id: string;
  name: string;
  stadiumId: number;
  startTime: string;
  endTime: string;
  matchStatus: string;
  stadiumName: string;
  predictionEnabled: boolean;
  currentRound: number;
}

interface Match {
  id: string;
  title: string;
  subtitle: string;
  stadium: string;
  datetime: string;
  matchStatus: string;
}

export default function PredictionPage() {
  const { user, setUser, refetchUser } = useUser();
  const { assets } = useUserAssets();
  const { toast } = useToast();
  const { startAdSession, stopAdSession, preloadAd, adSessionState, isNativePlatform } = useAdMob();

  const [, setLocation] = useLocation();
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedPrediction, setSelectedPrediction] =
    useState<PredictionOption | null>(null);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [showPendingPopup, setShowPendingPopup] = useState(false);
  const [showDonationPopup, setShowDonationPopup] = useState(false);

  const [predictionResult, setPredictionResult] = useState<
    "pending" | "success" | "fail"
  >("pending");
  const [successfulPredictionId, setSuccessfulPredictionId] = useState<number | null>(null);
  const [lastWonAmount, setLastWonAmount] = useState<number>(0);
  const [lastBetAmount, setLastBetAmount] = useState<number>(0);
  const [formattedDate, setFormattedDate] = useState("");
  const [waitingForPredictionStart, setWaitingForPredictionStart] = useState(false);
  const [hasPendingPrediction, _setHasPendingPrediction] = useState(false);
  const setHasPendingPrediction = useCallback((val: boolean) => {
    hasPendingPredictionRef.current = val;
    _setHasPendingPrediction(val);
  }, []);
  const [showAdOverlay, setShowAdOverlay] = useState(false); // 광고 화면 표시 여부 (웹용)
  const [adOverlayMessage, setAdOverlayMessage] = useState("광고가 재생 중입니다..."); // 광고 오버레이 메시지
  const [showPredictionStoppedPopup, setShowPredictionStoppedPopup] = useState(false); // 예측 중지 팝업

  const [wsConnectionState, setWsConnectionState] = useState<string>("disconnected");
  const [pollingTimedOut, setPollingTimedOut] = useState(false); // 폴링 타임아웃 여부
  const [pollingAuthFailed, setPollingAuthFailed] = useState(false); // 인증 실패로 폴링 중단
  const [checkingPrediction, setCheckingPrediction] = useState(false); // /check API 호출 중
  
  // 현재 경기의 상태 추적
  const hasPendingPredictionRef = useRef<boolean>(false); // WS 핸들러에서 접근용
  const canPredict = useRef<boolean>(false); // 예측 가능 여부
  const isWaitingForResultRef = useRef<boolean>(false); // 결과 대기 여부
  const isInPredictionFlow = useRef<boolean>(false); // 예측 플로우에 진입했는지 (대기/진행/결과 화면)

  const pollingStartTime = useRef<number | null>(null); // 폴링 시작 시간
  const resultShownRef = useRef<boolean>(false); // 결과 화면 표시 중 여부 (폴링이 덮어쓰지 않도록)
  const pendingEventsRef = useRef<Array<{ type: string; data: any }>>([]); // 결과 화면 중 큐잉된 이벤트
  const pollingTimedOutRef = useRef<boolean>(false); // WS 핸들러에서 폴링 타임아웃 상태 접근용
  const adSessionLocallyStoppedRef = useRef<boolean>(false); // 로컬에서 광고 세션을 종료했는지 여부
  const flushPendingEventsRef = useRef<(() => Promise<void>) | null>(null); // flushPendingEvents 함수 참조 (round_next timeout에서 사용)
  const prevUserIdRef = useRef<string | number | undefined>(undefined); // 유저 세션 변경 감지용
  const seenPreviousRoundRef = useRef<number | null>(null); // fromPreviousRound로 이미 본 라운드 번호
  const POLLING_TIMEOUT_MS = 420000; // 7분 타임아웃
  const activeBet = useRef<{
    round: number;
    prediction: PredictionOption;
    predictionId: number;
    timestamp: number;
    amount: number;
  } | null>(null); // 활성 베팅 정보
  
  // 경기 데이터 가져오기
  const { data: matchesData, isLoading } = useQuery<MatchData[]>({
    queryKey: ["/api/matches"],
    refetchOnMount: "always",
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => { pollingTimedOutRef.current = pollingTimedOut; }, [pollingTimedOut]);

  // WebSocket 이벤트 핸들러
  const wsHandlers: WSEventHandlers = {
    onConnected: useCallback((data: any) => {
      console.log("[WS] 연결됨:", data);
      setWsConnectionState("connected");
      
      if (resultShownRef.current) {
        console.log("[WS] 결과 화면 표시 중 - connected 이벤트 큐잉");
        pendingEventsRef.current.push({ type: "connected", data });
        return;
      }
      
      const hasSubmittedPrediction = activeBet.current !== null || isWaitingForResultRef.current || hasPendingPredictionRef.current;
      
      // WS 재연결 시 결과 대기 중이었고 폴링이 타임아웃 상태라면 폴링 재시작
      if (pollingTimedOutRef.current && hasSubmittedPrediction) {
        console.log("[WS] 재연결 - 폴링 타임아웃 상태 리셋하여 폴링 재시작");
        pollingStartTime.current = null;
        setPollingTimedOut(false);
      }
      
      if (data.predictionEnabled !== undefined) {
        if (data.predictionEnabled) {
          if (hasSubmittedPrediction) {
            console.log("[WS] 연결됨 - 이미 예측 제출한 사용자, 대기 화면 유지");
            canPredict.current = false;
            isInPredictionFlow.current = true;
            setWaitingForPredictionStart(false);
            setShowPendingPopup(true);
          } else {
            canPredict.current = true;
            isInPredictionFlow.current = false;
            setWaitingForPredictionStart(false);
            setShowPendingPopup(false);
          }
        } else {
          if (hasSubmittedPrediction) {
            console.log("[WS] 연결됨 - 예측 비활성화 + 이미 제출, 결과 대기 화면");
            canPredict.current = false;
            isInPredictionFlow.current = true;
            isWaitingForResultRef.current = true;
            setWaitingForPredictionStart(false);
            setPredictionResult("pending");
            setShowPredictionStoppedPopup(false);
            setShowConfirmPopup(false);
            setShowDonationPopup(false);
            setShowPendingPopup(true);
          } else {
            canPredict.current = false;
            isInPredictionFlow.current = true;
            setWaitingForPredictionStart(true);
            setPredictionResult("pending");
            setShowPredictionStoppedPopup(false);
            setShowConfirmPopup(false);
            setShowDonationPopup(false);
            setShowPendingPopup(true);
          }
        }
      }
    }, []),

    onUserAlreadyPredicted: useCallback((data: any) => {
      console.log("[WS] 사용자 이미 예측함:", data);
      
      if (resultShownRef.current) {
        console.log("[WS] 결과 화면 표시 중 - user_already_predicted 큐잉");
        pendingEventsRef.current.push({ type: "user_already_predicted", data });
        return;
      }
      
      isInPredictionFlow.current = true;

      // 이미 결과가 확정된 예측인 경우 즉시 결과 화면 표시 (이전 라운드 or 현재 라운드 재연결)
      if (data.status === 'success' || data.status === 'fail') {
        const roundNum = data.round ?? 0;
        // 이미 이 라운드 결과를 본 경우 재표시 방지
        if (seenPreviousRoundRef.current === roundNum) {
          console.log("[WS] 이미 확인한 라운드 결과 - 재표시 스킵 (round:", roundNum, ")");
          return;
        }
        const isSuccess = data.status === 'success';
        if (isSuccess) {
          setSuccessfulPredictionId(data.predictionId || 0);
        }
        setLastWonAmount(data.wonAmount ?? 0);
        setLastBetAmount(data.amount ?? 0);
        setSelectedPrediction(data.prediction as PredictionOption);
        setWaitingForPredictionStart(false);
        setPredictionResult(isSuccess ? "success" : "fail");
        setShowPredictionStoppedPopup(false);
        setShowConfirmPopup(false);
        setShowDonationPopup(false);
        setShowPendingPopup(true);
        activeBet.current = null;
        isWaitingForResultRef.current = false;
        resultShownRef.current = true;
        seenPreviousRoundRef.current = roundNum;
        return;
      }

      isWaitingForResultRef.current = true;
      activeBet.current = {
        round: data.round || 0,
        prediction: data.prediction,
        predictionId: data.predictionId || 0,
        timestamp: Date.now()
      };
      setSelectedPrediction(data.prediction as PredictionOption);
      setWaitingForPredictionStart(false);
      setPredictionResult("pending");
      setShowPredictionStoppedPopup(false);
      setShowConfirmPopup(false);
      setShowDonationPopup(false);
      setShowPendingPopup(true);
    }, []),

    onPredictionStarted: useCallback((data: any) => {
      console.log("[WS] 예측 시작:", data);
      
      if (resultShownRef.current) {
        console.log("[WS] 결과 화면 표시 중 - prediction_started 큐잉");
        pendingEventsRef.current.push({ type: "prediction_started", data });
        return;
      }

      stopAdSession();
      setShowAdOverlay(false);
      adSessionLocallyStoppedRef.current = true;
      
      const hasSubmittedPrediction = activeBet.current !== null || isWaitingForResultRef.current || hasPendingPredictionRef.current;
      
      if (hasSubmittedPrediction) {
        console.log("[WS] 예측 제출 사용자 - 결과 대기 화면 유지 (명시적 설정)");
        isWaitingForResultRef.current = true;
        canPredict.current = false;
        setWaitingForPredictionStart(false);
        setShowPredictionStoppedPopup(false);
        setShowConfirmPopup(false);
        setShowDonationPopup(false);
        setShowPendingPopup(true);
        setPredictionResult("pending");
        return;
      }
      
      isInPredictionFlow.current = false;
      canPredict.current = true;
      setWaitingForPredictionStart(false);
      setShowPendingPopup(false);
      setShowConfirmPopup(false);
      setShowPredictionStoppedPopup(false);
      setShowDonationPopup(false);
      setSelectedPrediction(null);
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    }, [stopAdSession]),

    onPredictionEnded: useCallback((data: any) => {
      console.log("[WS] 예측 중지:", data);
      
      if (resultShownRef.current) {
        console.log("[WS] 결과 화면 표시 중 - prediction_ended 큐잉");
        pendingEventsRef.current.push({ type: "prediction_ended", data });
        return;
      }
      
      canPredict.current = false;
      
      const hasSubmittedPrediction = activeBet.current !== null || isWaitingForResultRef.current || hasPendingPredictionRef.current;
      
      isInPredictionFlow.current = true;
      if (hasSubmittedPrediction) {
        // 예측 제출한 사용자: 결과 대기 화면
        console.log("[WS] 예측 제출 사용자 - 결과 대기 화면으로 전환");
        isWaitingForResultRef.current = true;
        setWaitingForPredictionStart(false); // 중요: 폴링 활성화를 위해 false로 설정
        setShowPredictionStoppedPopup(false);
        setShowConfirmPopup(false);
        setShowDonationPopup(false);
        setShowPendingPopup(true);
        setPredictionResult("pending");
      } else {
        // 예측 미제출 사용자: 예측 종료 안내 팝업 표시
        console.log("[WS] 예측 미제출 사용자 - 예측 종료 팝업 표시");
        isInPredictionFlow.current = true;
        isWaitingForResultRef.current = false;
        canPredict.current = false;
        activeBet.current = null;
        hasPendingPredictionRef.current = false;
        setSelectedPrediction(null);
        setHasPendingPrediction(false);
        setShowConfirmPopup(false);
        setShowDonationPopup(false);
        setWaitingForPredictionStart(true);
        setPredictionResult("pending");
        setShowPendingPopup(true);
        setShowPredictionStoppedPopup(true);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    }, []),

    onRoundResult: useCallback((data: any) => {
      console.log("[WS] 경기 결과 수신:", data);
      
      if (resultShownRef.current) {
        console.log("[WS] 결과 화면 이미 표시 중 - round_result 중복 처리 차단");
        return;
      }
      
      isWaitingForResultRef.current = false;
      canPredict.current = false;
      setWaitingForPredictionStart(false);
      
      if (activeBet.current) {
        const betPrediction = activeBet.current.prediction;
        const betPredictionId = activeBet.current.predictionId;
        const isSuccess = data.result === betPrediction;
        
        if (isSuccess) {
          setSuccessfulPredictionId(betPredictionId);
        }

        if (data.wonAmount !== undefined && data.wonAmount !== null) {
          const won = data.wonAmount;
          setLastWonAmount(won);
          setLastBetAmount(activeBet.current?.amount ?? 100);
          if (isSuccess && won > 0 && user) {
            setUser({ ...user, points: (user.points ?? 0) + won });
          }
        } else {
          (async () => {
            try {
              const token = getAccessToken();
              const predRes = await fetch(getFullUrl(`/api/live-match/predictions/${betPredictionId}`), {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
              });
              if (predRes.ok) {
                const predData = await predRes.json();
                const won = predData.wonAmount ?? 0;
                setLastWonAmount(won);
                setLastBetAmount(predData.amount ?? 100);
                if (isSuccess && won > 0 && user) {
                  setUser({ ...user, points: (user.points ?? 0) + won });
                }
              } else {
                setLastWonAmount(isSuccess ? 100 : 0);
                setLastBetAmount(activeBet.current?.amount ?? 100);
              }
            } catch (e) {
              console.error("[WS] wonAmount fallback 조회 실패:", e);
              setLastWonAmount(isSuccess ? 100 : 0);
              setLastBetAmount(activeBet.current?.amount ?? 100);
            }
          })();
        }

        resultShownRef.current = true;
        setPredictionResult(isSuccess ? "success" : "fail");
        setShowPredictionStoppedPopup(false);
        setShowConfirmPopup(false);
        setShowDonationPopup(false);
        setShowPendingPopup(true);
        activeBet.current = null;
      } else if (hasPendingPredictionRef.current) {
        console.log("[WS] activeBet 없지만 예측 제출 상태 - 폴링으로 결과 확인 위임");
        resultShownRef.current = true;
        setPredictionResult("pending");
        setShowPendingPopup(true);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      if (user) {
        queryClient.invalidateQueries({ queryKey: ["/api/live-match/predictions", user.id] });
      }
    }, [user]),

    onRoundNext: useCallback((data: any) => {
      console.log("[WS] 다음 라운드 전환:", data);
      
      if (resultShownRef.current) {
        console.log("[WS] 결과 화면 표시 중 - round_next 큐잉 (12초 후 강제 처리)");
        pendingEventsRef.current.push({ type: "round_next", data });
        setTimeout(() => {
          if (!resultShownRef.current) return;
          console.log("[WS] round_next 12초 경과 - 결과 화면 강제 닫고 전체 큐 재처리");
          resultShownRef.current = false;
          activeBet.current = null;
          isWaitingForResultRef.current = false;
          hasPendingPredictionRef.current = false;
          _setHasPendingPrediction(false);
          setSelectedPrediction(null);
          setPredictionResult("pending");
          setShowPredictionStoppedPopup(false);
          setShowConfirmPopup(false);
          setShowDonationPopup(false);
          setSuccessfulPredictionId(null);
          setLastWonAmount(0);
          setPollingTimedOut(false);
          setPollingAuthFailed(false);
          pollingStartTime.current = null;
          flushPendingEventsRef.current?.();
        }, 12000);
        return;
      }
      
      if (data.skippedResult && (activeBet.current !== null || hasPendingPredictionRef.current)) {
        toast({
          description: "이번 라운드 결과가 생략되었습니다.",
          duration: 4000,
        });
      }
      
      isWaitingForResultRef.current = false;
      setSelectedPrediction(null);
      setHasPendingPrediction(false);
      setLastWonAmount(0);
      activeBet.current = null;
      
      if (data.predictionEnabled) {
        canPredict.current = true;
        isInPredictionFlow.current = false;
        setWaitingForPredictionStart(false);
        setShowPendingPopup(false);
      } else {
        canPredict.current = false;
        isInPredictionFlow.current = true;
        setWaitingForPredictionStart(true);
        setPredictionResult("pending");
        setShowPendingPopup(true);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      if (user) {
        queryClient.invalidateQueries({ queryKey: ["/api/live-match/predictions", user.id] });
      }
    }, [user]),

    onStatsUpdate: useCallback((data: any) => {
      console.log("[WS] 통계 업데이트:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    }, []),

    onWaitingScreenUpdate: useCallback((data: any) => {
      console.log("[WS] 대기화면 변경 감지:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-screens"] });
    }, []),

    onAdStarted: useCallback(async (data: any) => {
      console.log("[WS] 광고 시작:", data);

      // 새 광고 세션 시작 알림이므로 로컬 종료 플래그를 즉시 초기화 (guard return 이전에 수행)
      adSessionLocallyStoppedRef.current = false;
      
      if (resultShownRef.current) {
        console.log("[WS] 결과 화면 표시 중 - ad_started 큐잉 + 백그라운드 광고 선행 로드");
        pendingEventsRef.current.push({ type: "ad_started", data });
        if (isNativePlatform) {
          preloadAd(); // 결과 화면 보는 동안 미리 광고 로드 → 닫히면 즉시 표시
        }
        return;
      }
      
      if (!isInPredictionFlow.current) {
        console.log("[WS] 예측 플로우가 아니므로 광고 무시");
        return;
      }
      
      setShowPendingPopup(false);
      setShowPredictionStoppedPopup(false);
      
      if (isNativePlatform) {
        console.log("[AdMob] 네이티브 플랫폼 - 광고 세션 시작");
        await startAdSession();
      } else {
        console.log("[AdMob] 웹 플랫폼 - 광고 오버레이 표시");
        setAdOverlayMessage("광고가 재생 중입니다...");
        setShowAdOverlay(true);
      }
    }, [isNativePlatform, startAdSession, preloadAd]),

    onAdStopped: useCallback((data: any) => {
      console.log("[WS] 광고 중지:", data);
      
      if (resultShownRef.current) {
        console.log("[WS] 결과 화면 표시 중 - ad_stopped 큐잉");
        pendingEventsRef.current.push({ type: "ad_stopped", data });
        return;
      }

      // 광고 세션이 서버에서도 종료됐으므로 로컬 종료 플래그 초기화
      adSessionLocallyStoppedRef.current = false;
      
      if (isNativePlatform) {
        stopAdSession();
      }
      setShowAdOverlay(false);

      if (!isInPredictionFlow.current) {
        console.log("[WS] 예측 플로우 아님 - ad_stopped 상태 복원 스킵");
        return;
      }
      
      if (isWaitingForResultRef.current) {
        setShowPredictionStoppedPopup(false);
        setShowConfirmPopup(false);
        setShowDonationPopup(false);
        setShowPendingPopup(true);
        setPredictionResult("pending");
      } else if (canPredict.current) {
        setShowPredictionStoppedPopup(false);
        setShowPendingPopup(false);
      } else {
        setShowPredictionStoppedPopup(false);
        setWaitingForPredictionStart(true);
        setPredictionResult("pending");
        setShowPendingPopup(true);
      }
    }, [isNativePlatform, stopAdSession]),

    onAdStatus: useCallback(async (data: any) => {
      console.log("[WS] 광고 상태:", data);
      if (data.isAdPlaying) {
        if (resultShownRef.current) {
          console.log("[WS] 결과 화면 표시 중 - ad_status 큐잉");
          pendingEventsRef.current.push({ type: "ad_status", data });
          return;
        }
        if (!isInPredictionFlow.current) {
          console.log("[WS] 예측 플로우가 아니므로 광고 상태 무시");
          return;
        }
        // 로컬에서 이미 광고 세션을 종료한 경우 재활성화 방지
        if (adSessionLocallyStoppedRef.current) {
          console.log("[WS] 로컬에서 광고 세션이 종료됐으므로 ad_status 무시");
          return;
        }
        setShowPendingPopup(false);
        if (isNativePlatform) {
          await startAdSession();
        } else {
          setAdOverlayMessage("광고가 재생 중입니다...");
          setShowAdOverlay(true);
        }
      } else {
        if (isNativePlatform) stopAdSession();
        setShowAdOverlay(false);
      }
    }, [isNativePlatform, startAdSession, stopAdSession]),

    onError: useCallback((error: Error) => {
      console.error("[WS] 연결 오류:", error);
      toast({
        title: "연결 오류",
        description: error.message,
        variant: "destructive",
      });
    }, [toast]),

    onReconnecting: useCallback((attempt: number) => {
      console.log(`[WS] 재연결 시도 ${attempt}/50`);
      setWsConnectionState("reconnecting");
    }, []),

    onMatchEnd: useCallback((data: any) => {
      console.log("[WS] 경기 종료:", data);

      if (resultShownRef.current) {
        console.log("[WS] 결과 화면 표시 중 - match_end 큐잉");
        pendingEventsRef.current.push({ type: "match_end", data });
        return;
      }

      toast({
        description: "경기가 종료되었습니다.",
      });
      clearMatchSelection();
    }, []),
  };

  // WebSocket 연결
  const { connectionState, isConnected, reconnect } = useMatchWebSocket({
    matchId: selectedMatch?.id || null,
    userId: user?.id?.toString() || null,
    handlers: wsHandlers,
    autoConnect: true,
  });

  // 연결 상태 동기화
  useEffect(() => {
    setWsConnectionState(connectionState);
  }, [connectionState]);

  // 경기 선택 시 상태 초기화
  useEffect(() => {
    if (selectedMatch) {
      canPredict.current = false;
      isWaitingForResultRef.current = false;
      activeBet.current = null;
    }
  }, [selectedMatch?.id]);

  // 대기 화면에서 경기 상태 폴링 (WebSocket 이벤트 백업)
  useEffect(() => {
    if (!waitingForPredictionStart || !selectedMatch?.id) {
      return;
    }

    console.log("[Polling] 경기 상태 폴링 시작, matchId:", selectedMatch.id);
    let stopped = false;

    const checkMatchStatus = async () => {
      if (stopped || resultShownRef.current) {
        return;
      }
      try {
        const response = await apiRequest("GET", `/api/matches/${selectedMatch.id}`);
        if (!response.ok) {
          console.log("[Polling] 경기 상태 API 실패:", response.status);
          return;
        }
        const matchData = await response.json();
        console.log("[Polling] 경기 상태: predictionEnabled=", matchData.predictionEnabled, "matchStatus=", matchData.matchStatus);
        
        if (stopped) return;
        
        if (matchData.predictionEnabled) {
          console.log("[Polling] 예측 활성화 감지! 예측 화면으로 전환");
          
          const hasSubmittedPrediction = activeBet.current !== null || isWaitingForResultRef.current || hasPendingPredictionRef.current;
          
          canPredict.current = !hasSubmittedPrediction;
          isInPredictionFlow.current = hasSubmittedPrediction;
          setWaitingForPredictionStart(false);
          
          if (hasSubmittedPrediction) {
            console.log("[Polling] 예측 제출 사용자 - 결과 대기 상태 유지");
          } else {
            setShowPendingPopup(false);
            setShowPredictionStoppedPopup(false);
            setShowDonationPopup(false);
          }
          queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
        }
      } catch (error) {
        console.error("[Polling] 경기 상태 확인 오류:", error);
      }
    };

    checkMatchStatus();

    const intervalId = setInterval(checkMatchStatus, 2000);

    return () => {
      stopped = true;
      console.log("[Polling] 경기 상태 폴링 종료");
      clearInterval(intervalId);
    };
  }, [waitingForPredictionStart, selectedMatch?.id]);

  // 결과 대기 중일 때 예측 결과 폴링 (WebSocket round_result 이벤트 백업)
  // 핵심: "예측 시작 대기"와 "결과 대기"를 구분하여 처리
  useEffect(() => {
    // 조건: 대기 화면이 표시 중이고, "결과 대기" 상태일 때만 (예측 시작 대기 아님)
    if (!showPendingPopup || predictionResult !== "pending" || waitingForPredictionStart) {
      // 폴링 조건 해제 시 타임아웃 상태도 초기화
      pollingStartTime.current = null;
      return;
    }

    // 선택된 경기가 없으면 폴링 안함
    if (!selectedMatch?.id) {
      return;
    }

    // 타임아웃 또는 인증 실패 상태면 폴링하지 않음
    if (pollingTimedOut || pollingAuthFailed) {
      return;
    }

    // 폴링 시작 시간 기록
    if (!pollingStartTime.current) {
      pollingStartTime.current = Date.now();
      console.log("[Polling] 예측 결과 폴링 시작, matchId:", selectedMatch.id);
    }

    const checkPredictionStatus = async () => {
      // 타임아웃 체크 (2분)
      if (pollingStartTime.current && Date.now() - pollingStartTime.current > POLLING_TIMEOUT_MS) {
        console.log("[Polling] 폴링 타임아웃 - 2분 초과");
        setPollingTimedOut(true);
        return;
      }

      try {
        // apiRequest 사용 - 자동 토큰 리프레시 및 401 처리 내장
        const response = await apiRequest("GET", `/api/live-match/predictions/${selectedMatch.id}/check`);
        
        if (response.ok) {
          const data = await response.json();
          
          // 예측이 없는 경우 처리
          if (!data.hasPrediction) {
            if (resultShownRef.current) {
              return;
            }
            if (isWaitingForResultRef.current) {
              return;
            }
            
            // 핵심: activeBet이 있고, 그 라운드가 현재 라운드와 다르면
            // 이전 라운드 결과를 아직 기다리는 중이므로 해당 예측 상태를 직접 확인
            if (activeBet.current && activeBet.current.round !== data.roundNumber) {
              console.log("[Polling] 이전 라운드 결과 대기 중");
              
              // 이전 라운드 예측 상태 직접 확인
              try {
                const prevPredictionRes = await apiRequest("GET", `/api/live-match/predictions/${activeBet.current.predictionId}`);
                if (prevPredictionRes.ok) {
                  const prevData = await prevPredictionRes.json();
                  
                  if (prevData.status === 'success' || prevData.status === 'fail') {
                    console.log("[Polling] 이전 라운드 결과 감지! 결과:", prevData.status);
                    pollingStartTime.current = null;
                    isWaitingForResultRef.current = false;
                    canPredict.current = false;
                    setWaitingForPredictionStart(false);
                    
                    const isSuccess = prevData.status === 'success';
                    if (isSuccess) {
                      setSuccessfulPredictionId(activeBet.current.predictionId);
                    }
                    setLastWonAmount(prevData.wonAmount ?? 0);
                    setLastBetAmount(prevData.amount ?? 0);
                    if (user && isSuccess && prevData.wonAmount > 0) {
                      setUser({ ...user, points: (user.points ?? 0) + prevData.wonAmount });
                    }
                    resultShownRef.current = true;
                    setPredictionResult(isSuccess ? "success" : "fail");
                    activeBet.current = null;
                    
                    queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
                    if (user) {
                      queryClient.invalidateQueries({ queryKey: ["/api/live-match/predictions", user.id] });
                    }
                    return;
                  }
                  // 아직 pending이면 계속 대기
                }
              } catch (prevError) {
                console.error("[Polling] 이전 라운드 예측 확인 오류:", prevError);
              }
              // 결과 대기 상태 유지, 폴링 계속
              return;
            }
            
            console.log("[Polling] 예측 없음 감지, 대기 화면 해제");
            pollingStartTime.current = null;
            if (data.predictionEnabled) {
              // 예측 활성화 상태면 예측 가능 (선택 화면이므로 광고 불필요)
              isInPredictionFlow.current = false;
              canPredict.current = true;
              setWaitingForPredictionStart(false);
              setShowPendingPopup(false);
              setShowPredictionStoppedPopup(false);
              setShowDonationPopup(false);
            } else {
              // 예측 비활성화면 시작 대기 상태로 전환
              isInPredictionFlow.current = true;
              canPredict.current = false;
              setWaitingForPredictionStart(true);
              // showPendingPopup은 유지 (시작 대기 화면)
            }
            activeBet.current = null;
            return;
          }
          
          // fromPreviousRound인데 activeBet 라운드와 다르면 → 현재 예측과 무관한 이전 결과, 무시
          if (data.fromPreviousRound && activeBet.current?.round !== data.roundNumber) {
            return;
          }

          // 예측이 있고 결과가 나온 경우 ('fail'이 올바른 값)
          if (data.status === 'success' || data.status === 'fail') {
            console.log("[Polling] 예측 결과 감지! 결과 화면으로 전환, status:", data.status);
            pollingStartTime.current = null;
            isWaitingForResultRef.current = false;
            canPredict.current = false;
            setWaitingForPredictionStart(false);
            
            const isSuccess = data.status === 'success';
            if (isSuccess && data.predictionId) {
              setSuccessfulPredictionId(data.predictionId);
            }
            setLastWonAmount(data.wonAmount ?? 0);
            setLastBetAmount(data.amount ?? 0);
            if (user && isSuccess && data.wonAmount > 0) {
              setUser({ ...user, points: (user.points ?? 0) + data.wonAmount });
            }
            resultShownRef.current = true;
            setPredictionResult(isSuccess ? "success" : "fail");
            activeBet.current = null;
            
            queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
            if (user) {
              queryClient.invalidateQueries({ queryKey: ["/api/live-match/predictions", user.id] });
            }
          }
          // 아직 pending이면 계속 폴링
        }
      } catch (error) {
        if (error instanceof Error && (error.message.includes("401") || error.message.includes("세션이 만료"))) {
          console.log("[Polling] 인증 에러 - 폴링 중단 (로그아웃 팝업 표시 안함)");
          pollingStartTime.current = null;
          setPollingAuthFailed(true);
          return;
        }
        console.error("[Polling] 예측 결과 확인 오류:", error);
      }
    };

    const intervalId = setInterval(checkPredictionStatus, 2000);

    // 즉시 한 번 확인
    checkPredictionStatus();

    return () => {
      console.log("[Polling] 예측 결과 폴링 종료");
      clearInterval(intervalId);
    };
  }, [showPendingPopup, predictionResult, waitingForPredictionStart, selectedMatch?.id, user, pollingTimedOut, pollingAuthFailed]);

  // 타임아웃 시 재시도 함수
  const handleRetryPolling = useCallback(() => {
    console.log("[Polling] 재시도 요청");
    pollingStartTime.current = null; // null로 설정하여 effect에서 새로 시작 시간 기록
    setPollingTimedOut(false); // 이 상태 변경으로 effect가 다시 실행됨
  }, []);

  useEffect(() => {
    const now = new Date();

    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
    };

    const localeDate = now.toLocaleDateString("ko-KR", options);
    const parts = localeDate.split(" ");
    const year = parts[0].replace(".", "년");
    const month = parts[1].replace(".", "월");
    const day = parts[2].replace(".", "일");
    const weekday = parts[3];

    setFormattedDate(`${year} ${month} ${day} ${weekday}`);
  }, []);

  // 경기 데이터를 UI에 맞게 변환
  const matches: Match[] =
    matchesData?.map((match) => {
      const startTime = new Date(match.startTime);
      const formattedTime = startTime
        .toLocaleString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
        .replace(/\. /g, "-")
        .replace(".", "");

      return {
        id: match.id,
        title: match.name,
        subtitle: `경기 #${match.id}`,
        stadium: match.stadiumName,
        datetime: formattedTime,
        matchStatus: match.matchStatus,
      };
    }) || [];

  const predictionOptions: PredictionOption[] = [
    "1루",
    "2루",
    "3루",
    "홈런",
    "아웃",
  ];

  // 각 예측 옵션별 기본 색상
  const predictionColors: Record<PredictionOption, string> = {
    "1루": "#F9A8D4",
    "2루": "#FDBA74",
    "3루": "#FDE047",
    "홈런": "#86EFAC",
    "아웃": "#D8B4FE",
  };

  const closeAllPopups = useCallback(() => {
    setShowPredictionStoppedPopup(false);
    setShowConfirmPopup(false);
    setShowDonationPopup(false);
    setShowPendingPopup(false);
  }, []);

  const clearMatchSelection = useCallback(() => {
    setSelectedMatch(null);
    setSelectedPrediction(null);
    setHasPendingPrediction(false);
    setPredictionResult("pending");
    setShowPendingPopup(false);
    setWaitingForPredictionStart(false);
    setShowPredictionStoppedPopup(false);
    setShowConfirmPopup(false);
    setShowDonationPopup(false);
    setSuccessfulPredictionId(null);
    setLastWonAmount(0);
    setLastBetAmount(0);
    setPollingTimedOut(false);
    setPollingAuthFailed(false);
    activeBet.current = null;
    isWaitingForResultRef.current = false;
    canPredict.current = false;
    isInPredictionFlow.current = false;
    pollingStartTime.current = null;
    resultShownRef.current = false;
    seenPreviousRoundRef.current = null;
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      clearMatchSelection();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [clearMatchSelection]);

  // 로그아웃 후 재로그인 시 경기 선택 초기화
  useEffect(() => {
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== user?.id) {
      clearMatchSelection();
    }
    prevUserIdRef.current = user?.id;
  }, [user?.id, clearMatchSelection]);

  const handleMatchSelect = async (match: Match) => {
    if (!user) return;
    
    window.history.pushState({ matchSelected: true }, "");

    // 경기 선택 시 항상 초기화
    setSelectedMatch(match);
    setSelectedPrediction(null);
    setHasPendingPrediction(false);
    setPredictionResult("pending");
    setShowPendingPopup(false);
    setWaitingForPredictionStart(false);

    // 선택한 경기의 예측 활성화 상태 확인
    const matchData = matchesData?.find((m) => m.id === match.id);
    const isPredictionEnabled = matchData?.predictionEnabled ?? false;
    
    // 항상 /check API를 먼저 호출하여 이미 제출한 예측이 있는지 확인
    setCheckingPrediction(true);
    try {
      const response = await apiRequest("GET", `/api/live-match/predictions/${match.id}/check`);
      const data = await response.json();
      
      if (data.hasPrediction) {
        setHasPendingPrediction(true);
        isInPredictionFlow.current = true;
        
        if (data.status === 'success' || data.status === 'fail') {
          const isSuccess = data.status === 'success';
          if (isSuccess) {
            setSuccessfulPredictionId(data.predictionId);
          }
          setLastWonAmount(data.wonAmount ?? 0);
          setLastBetAmount(data.amount ?? 0);
          setPredictionResult(isSuccess ? "success" : "fail");
          setShowPredictionStoppedPopup(false);
          setShowConfirmPopup(false);
          setShowDonationPopup(false);
          setShowPendingPopup(true);
          activeBet.current = null;
        } else {
          setPredictionResult("pending");
          setShowPredictionStoppedPopup(false);
          setShowConfirmPopup(false);
          setShowDonationPopup(false);
          setShowPendingPopup(true);
          activeBet.current = {
            round: data.roundNumber,
            prediction: data.prediction as PredictionOption,
            predictionId: data.predictionId,
            timestamp: Date.now(),
            amount: data.amount ?? 100,
          };
        }
        
        setWaitingForPredictionStart(false);
        canPredict.current = false;
        isWaitingForResultRef.current = true;
      } else if (isPredictionEnabled) {
        isInPredictionFlow.current = false;
        canPredict.current = true;
        setWaitingForPredictionStart(false);
        setShowPendingPopup(false);
      } else {
        canPredict.current = false;
        isInPredictionFlow.current = true;
        setWaitingForPredictionStart(true);
        setPredictionResult("pending");
        setShowPredictionStoppedPopup(false);
        setShowConfirmPopup(false);
        setShowDonationPopup(false);
        setShowPendingPopup(true);
      }
    } catch (error) {
      console.error("예측 확인 실패:", error);
      if (isPredictionEnabled) {
        isInPredictionFlow.current = false;
        canPredict.current = true;
        setWaitingForPredictionStart(false);
        setShowPendingPopup(false);
      } else {
        canPredict.current = false;
        isInPredictionFlow.current = true;
        setWaitingForPredictionStart(true);
        setPredictionResult("pending");
        setShowPendingPopup(true);
      }
    } finally {
      setCheckingPrediction(false);
    }
  };

  const handlePredictionSelect = (option: PredictionOption) => {
    if (waitingForPredictionStart) {
      toast({
        description: "아직 예측이 시작되지 않았습니다.",
        variant: "destructive",
      });
      return;
    }
    setSelectedPrediction(option);
    setShowPredictionStoppedPopup(false);
    setShowDonationPopup(false);
    setShowPendingPopup(false);
    setShowConfirmPopup(true);
  };

  const handleConfirm = async () => {
    if (!user || !selectedMatch || !selectedPrediction) return;

    setShowConfirmPopup(false);
    setPredictionResult("pending");
    setShowPendingPopup(true);
    setShowPredictionStoppedPopup(false); // 예측 중지 팝업도 숨기기
    
    // 핵심: POST 요청 전에 미리 플래그 설정
    // 폴링/WebSocket 이벤트가 "예측 시작" 팝업을 표시하지 않도록 방지
    isInPredictionFlow.current = true;
    isWaitingForResultRef.current = true;
    canPredict.current = false;
    setWaitingForPredictionStart(false);

    setHasPendingPrediction(true);

    try {
      const response = await apiRequest("POST", "/api/live-match/predictions", {
        matchId: selectedMatch.id,
        prediction: selectedPrediction,
        amount: 100,
      });
      
      const data = await response.json();
      
      activeBet.current = {
        round: data.roundNumber,
        prediction: selectedPrediction,
        predictionId: data.id,
        timestamp: Date.now(),
        amount: 100,
      };

      if (user) {
        setUser({ ...user, points: (user.points ?? 0) - 100 });
      }
    } catch (error: any) {
      console.error("예측 생성 실패:", error);
      setShowPendingPopup(false);
      
      // 에러 응답 확인
      const errorMessage = error?.message || "예측 생성에 실패했습니다.";
      
      // 상태 초기화 (제출 실패했으므로)
      setHasPendingPrediction(false);
      setSelectedPrediction(null);
      isWaitingForResultRef.current = false;
      canPredict.current = true;
      
      if (errorMessage.includes("예측이 불가능합니다") || errorMessage.includes("예측 시작을 기다려주세요")) {
        canPredict.current = false;
        isInPredictionFlow.current = true;
        setWaitingForPredictionStart(true);
        setShowPendingPopup(true);
        setShowDonationPopup(false);
      } else {
        isInPredictionFlow.current = false;
        toast({
          title: "오류",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  };

  const handleClosePending = () => {
    // Architect 지침: 항상 오버레이만 닫기
    // SSE 연결과 activeBet은 유지하여 백그라운드에서 결과 받기
    setShowPendingPopup(false);
  };

  const resetAllPredictionState = () => {
    resultShownRef.current = false;
    activeBet.current = null;
    isWaitingForResultRef.current = false;
    hasPendingPredictionRef.current = false;
    _setHasPendingPrediction(false);
    setSelectedPrediction(null);
    setPredictionResult("pending");
    setShowPredictionStoppedPopup(false);
    setShowConfirmPopup(false);
    setShowDonationPopup(false);
    setSuccessfulPredictionId(null);
    setLastWonAmount(0);
    setLastBetAmount(0);
    setPollingTimedOut(false);
    setPollingAuthFailed(false);
    pollingStartTime.current = null;
    console.log("[resetAllPredictionState] 모든 예측 상태 초기화 완료");
  };

  const flushPendingEvents = async () => {
    const events = pendingEventsRef.current;
    pendingEventsRef.current = [];
    if (events.length === 0) {
      console.log("[flushPendingEvents] 큐가 비어있음 - checkAndShowWaitingScreen 호출");
      checkAndShowWaitingScreen();
      return;
    }
    console.log(`[flushPendingEvents] ${events.length}개 이벤트 재처리:`, events.map(e => e.type));

    // ad_started + ad_stopped 가 둘 다 큐에 있으면 광고 기간이 이미 지난 것이므로 둘 다 건너뜀.
    // ad_started 만 있으면 광고가 아직 진행 중이므로 정상 처리.
    // ad_stopped 가 큐에 있으면 ad_status 도 stale이므로 스킵 (이미 끝난 광고 재시작 방지).
    const hasQueuedAdStarted = events.some(e => e.type === "ad_started");
    const hasQueuedAdStopped = events.some(e => e.type === "ad_stopped");
    const skipAdEvents = hasQueuedAdStarted && hasQueuedAdStopped;
    if (skipAdEvents) {
      console.log("[flushPendingEvents] ad_started+ad_stopped 둘 다 큐에 있음 - 광고 기간 경과, 두 이벤트 모두 스킵");
    }
    if (hasQueuedAdStopped) {
      console.log("[flushPendingEvents] ad_stopped 큐에 있음 - ad_status stale 처리, 스킵");
    }

    let matchEndProcessed = false;

    for (const event of events) {
      console.log(`[flushPendingEvents] 이벤트 재처리: ${event.type}`);
      switch (event.type) {
        case "connected":
          wsHandlers.onConnected?.(event.data);
          break;
        case "user_already_predicted":
          wsHandlers.onUserAlreadyPredicted?.(event.data);
          break;
        case "round_next":
          wsHandlers.onRoundNext?.(event.data);
          break;
        case "prediction_started":
          wsHandlers.onPredictionStarted?.(event.data);
          break;
        case "prediction_ended":
          wsHandlers.onPredictionEnded?.(event.data);
          break;
        case "ad_started":
          if (!skipAdEvents) await wsHandlers.onAdStarted?.(event.data);
          break;
        case "ad_stopped":
          if (!skipAdEvents) wsHandlers.onAdStopped?.(event.data);
          break;
        case "ad_status":
          if (!hasQueuedAdStopped) wsHandlers.onAdStatus?.(event.data);
          break;
        case "match_end":
          wsHandlers.onMatchEnd?.(event.data);
          matchEndProcessed = true;
          break;
      }
    }
    if (!matchEndProcessed && !canPredict.current && !isWaitingForResultRef.current && !resultShownRef.current) {
      console.log("[flushPendingEvents] 이벤트 재처리 후 상태 불확실 - checkAndShowWaitingScreen 보조 호출");
      checkAndShowWaitingScreen();
    }
  };

  flushPendingEventsRef.current = flushPendingEvents;

  const handleFailAutoReturn = () => {
    console.log("[handleFailAutoReturn] 실패 화면 3초 자동 종료 - 상태 초기화 후 이벤트 재처리");
    resetAllPredictionState();
    setShowPendingPopup(false);
    flushPendingEvents();
  };

  const handlePredictionSuccess = async () => {
    console.log("[handlePredictionSuccess] 성공 화면 종료 - 상태 초기화 후 이벤트 재처리");
    resetAllPredictionState();
    setShowPendingPopup(false);
    flushPendingEvents();
  };

  const handleSuccessAutoReturn = () => {
    if (!resultShownRef.current) return;
    console.log("[handleSuccessAutoReturn] 성공 화면 5초 자동 종료 - 상태 초기화 후 이벤트 재처리");
    resetAllPredictionState();
    setShowPendingPopup(false);
    flushPendingEvents();
  };

  const handleDonate = () => {
    setShowPendingPopup(false);
    setShowDonationPopup(true);
  };

  const checkAndShowWaitingScreen = async () => {
    isInPredictionFlow.current = true;
    setWaitingForPredictionStart(true);
    setShowPredictionStoppedPopup(false);
    setShowConfirmPopup(false);
    setShowDonationPopup(false);
    setShowPendingPopup(true);

    if (selectedMatch?.id) {
      try {
        const response = await fetch(getFullUrl(`/api/matches/${selectedMatch.id}`));
        if (response.ok) {
          const matchData = await response.json();
          if (matchData.predictionEnabled) {
            isInPredictionFlow.current = false;
            canPredict.current = true;
            setWaitingForPredictionStart(false);
            setShowPendingPopup(false);
          }
        }
      } catch (e) {
        console.error("[checkAndShowWaitingScreen] 경기 상태 확인 오류:", e);
      }
    }
  };

  const handleDonationConfirm = async (percentage: number) => {
    if (percentage === 0) {
      setShowDonationPopup(false);
      resetAllPredictionState();
      setShowPendingPopup(false);
      flushPendingEvents();
      return;
    }

    if (!user) {
      toast({
        title: "기부 실패",
        description: "로그인이 필요합니다.",
        variant: "destructive",
      });
      setShowDonationPopup(false);
      setSuccessfulPredictionId(null);
      return;
    }

    if (!successfulPredictionId) {
      toast({
        title: "기부 실패",
        description: "성공한 예측을 찾을 수 없습니다.",
        variant: "destructive",
      });
      setShowDonationPopup(false);
      return;
    }

    try {
      const response = await apiRequest("POST", `/api/live-match/predictions/${successfulPredictionId}/donate`);
      const data = await response.json();

      if (!data.donationAmount || data.donationAmount <= 0) {
        toast({
          title: "기부 불가",
          description: "기부 가능한 상금이 없습니다.",
        });
      } else {
        toast({
          title: "기부 완료",
          description: `${data.donationAmount} 참여 기록을 기부하셨습니다.`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/live-match/predictions", user.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      try {
        await refetchUser();
      } catch (e) {
        console.error("[Donation] refetchUser failed, ignoring:", e);
      }
    } catch (error: any) {
      toast({
        title: "기부 실패",
        description: error.message || "기부 처리에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setShowDonationPopup(false);
      resetAllPredictionState();
      setShowPendingPopup(false);
      flushPendingEvents();
    }
  };

  return (
    <div className="h-app-screen bg-[#111111] flex flex-col">
      {/* 헤더 */}
      <PageHeader />

      {/* 메인 컨텐츠 */}
      <div className="flex-1 px-5 pt-[10px] overflow-y-scroll-touch pb-bottom-nav-with-bar">
        <h1 data-testid="text-page-title" className="text-white text-[20px] font-bold text-center pt-2 pb-2">경기 참여하기</h1>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[#D5D5D5] text-sm">{formattedDate}</p>
          <span className="text-[#D5D5D5] text-sm" data-testid="text-user-points">보유 참여기록 : {user?.points ?? 0}</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-[#D5D5D5]">경기 정보를 불러오는 중...</p>
          </div>
        ) : (
          <>
            {!selectedMatch ? (
              /* 경기 선택 */
              <>
                <h2 className="text-white text-base font-bold mb-2 mt-3">
                  경기 선택
                </h2>
                <div className="space-y-2">
                  {matches.map((match) => {
                    const isCompleted = match.matchStatus === 'completed';
                    return (
                      <button
                        key={match.id}
                        data-testid={`match-${match.id}`}
                        onClick={() => !isCompleted && handleMatchSelect(match)}
                        disabled={isCompleted}
                        className={`w-full bg-[#1A1A1A] rounded-lg p-3 flex items-center justify-between gap-3 transition-colors ${
                          isCompleted
                            ? 'opacity-50 cursor-not-allowed'
                            : ''
                        }`}
                      >
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-white text-sm font-bold">
                            {match.title}
                          </span>
                          <span className="text-[#AAAAAA] text-xs flex items-center gap-1">
                            <img src={assets.stadiumIcon}></img>
                            {match.stadium}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isCompleted ? (
                            <span className="text-[#6B6B6B] text-sm">
                              종료된 경기
                            </span>
                          ) : (
                            <>
                              <div className="w-[6px] h-[6px] rounded-full bg-[#92E945]"></div>
                              <span className="text-[#CDFF00] text-sm">
                                 선택 가능
                              </span>
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              /* 선택된 경기 & 예측 선택 */
              <>
                <h2 className="text-white text-base font-bold mb-2 mt-2">
                  경기 선택
                </h2>
                <div
                  data-testid="selected-match"
                  onClick={() => {
                    if (window.history.state && window.history.state.matchSelected) {
                      window.history.back();
                    } else {
                      clearMatchSelection();
                    }
                  }}
                  className="relative w-full rounded-lg p-3 mb-3 bg-[#1C1F20]"
                >
                  {/* 테두리용 ::before */}
                  <div
                    className="absolute inset-0 rounded-lg pointer-events-none"
                    style={{
                      padding: "1px", // border 두께
                      backgroundImage: "linear-gradient(to right, #CDFF00, #97862A)",
                      WebkitMask:
                        "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                      WebkitMaskComposite: "destination-out",
                      maskComposite: "exclude",
                    }}
                  ></div>

                  {/* 안쪽 컨텐츠 */}
                  <div className="flex items-center justify-between gap-3 relative z-10">
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-white text-sm font-bold">
                        {selectedMatch.title}
                      </span>
                      <span className="text-[#AAAAAA] text-xs flex items-center gap-1">
                        <img src={assets.stadiumIcon} alt="stadium icon" />
                        {selectedMatch.stadium}
                      </span>
                    </div>
                    <span className="text-[#6B6B6B] text-xs">클릭하여 다시 선택</span>
                  </div>
                </div>


                <h2 className="text-white text-base font-bold mb-2">
                  예측 선택
                </h2>
                {checkingPrediction ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-[#CDFF00] border-t-transparent rounded-full animate-spin mb-3"></div>
                    <span className="text-[#AAAAAA] text-sm">확인 중...</span>
                  </div>
                ) : (
                  <div className="space-y-2 pb-20">
                    {predictionOptions.map((option) => (
                      <button
                        key={option}
                        data-testid={`prediction-${option}`}
                        onClick={() => handlePredictionSelect(option)}
                        className="w-full bg-[#1A1A1A] border border-[#373539] hover:border-[#6B6B6B] rounded-lg p-3 flex items-center justify-between gap-3 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: predictionColors[option] }}
                          ></span>
                          <span 
                            className="text-sm font-medium"
                            style={{ color: predictionColors[option] }}
                          >
                            {option}
                          </span>
                        </div>
                        <span className="text-[#6B6B6B] text-xs">
                          클릭하여 다시 선택
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>


      {/* 확인 팝업 */}
      {showConfirmPopup && selectedMatch && selectedPrediction && (
        <ConfirmPopup
          title="예측 정보를 확인해 주세요"
          details={[
            { label: "경기구장", value: selectedMatch.stadium },
            { label: "일시", value: selectedMatch.datetime },
            { label: "예측 참여기록", value: "100" },
            { label: "예측", value: selectedPrediction },
          ]}
          footerLabel="예측 후 잔여기록"
          footerValue={`${(user?.points ?? 0) - 100}`}
          onCancel={() => { setShowConfirmPopup(false); setSelectedPrediction(null); }}
          onConfirm={handleConfirm}
        />
      )}

      {/* 대기/성공/실패 팝업 */}
      {showPendingPopup && selectedMatch && (
        <LoadingOverlay
          matchInfo={selectedMatch.stadium}
          datetime={selectedMatch.datetime}
          predictState={predictionResult}
          prediction={waitingForPredictionStart ? undefined : (selectedPrediction ?? undefined)}
          onClose={handleClosePending}
          waitingMessage={waitingForPredictionStart ? "다음 타자 예측을 기다리는 중 입니다." : undefined}
          matchId={selectedMatch.id}
          hasPendingPrediction={hasPendingPrediction}
          isTimedOut={pollingTimedOut}
          onRetry={handleRetryPolling}
          wonAmount={lastWonAmount}
          onFailAutoReturn={handleFailAutoReturn}
          onSuccessAutoReturn={handleSuccessAutoReturn}
          onDonate={successfulPredictionId && lastWonAmount > lastBetAmount ? handleDonate : undefined}
        />
      )}

      {/* 기부 팝업 */}
      {showDonationPopup && <DonationPopup onConfirm={handleDonationConfirm} />}


      {/* 광고 오버레이 (웹 또는 네이티브 preparing/overlay 상태) */}
      {((showAdOverlay && !isNativePlatform) || 
        (isNativePlatform && (adSessionState === "preparing" || adSessionState === "overlay"))) && 
        selectedMatch && (
        <LoadingOverlay
          matchInfo={selectedMatch.stadium}
          datetime={selectedMatch.datetime}
          predictState="pending"
          onClose={() => {}}
          waitingMessage={
            isNativePlatform 
              ? (adSessionState === "preparing" ? "광고 준비중입니다..." : "광고가 재생 중입니다...")
              : adOverlayMessage
          }
          matchId={selectedMatch.id}
          hasPendingPrediction={false}
        />
      )}
      {showPredictionStoppedPopup && (
        <SimpleInfoPopup
          message={"예측이 종료되었습니다.\n다음 예측을 기다려주세요."}
          onClose={() => setShowPredictionStoppedPopup(false)}
        />
      )}
      <BottomNavigation />
    </div>
  );
}
