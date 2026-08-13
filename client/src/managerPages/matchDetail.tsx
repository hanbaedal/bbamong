import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import AdminConfirmPopup from "@/components/customUi/AdminConfirmPopup";
import { managerFetch, refreshAccessToken, dispatchManagerMatchEnded } from "@/lib/managerQueryClient";
import { getManagerAccessToken } from "@/lib/managerTokenManager";
import { useManagerAssets } from "@/contexts/ManagerAssetContext";
import { useToast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import ManagerOperatorScorePanel from "@/components/ManagerOperatorScorePanel";
import ManagerLineupEditor, { type LineupSide } from "@/components/ManagerLineupEditor";
import ManagerPinchHitterEditor from "@/components/ManagerPinchHitterEditor";
import { setGameImmersiveMode } from "@/lib/systemUiPlugin";
import { resolveMatchTeamNames } from "@shared/matchTeamDisplay";
import { refreshGameKeepAwake, setGameKeepAwake } from "@/lib/screenWakeLock";
import { useManagerProactiveSessionRefresh } from "@/hooks/useManagerProactiveSessionRefresh";
import { useLiveScoreboard } from "@/hooks/useLiveScoreboard";
import { shouldClientPollMatch, msUntilMatchPollWindow } from "@/lib/matchPollWindow";
import { getDisplayStadiumName } from "@shared/stadiumDisplay";
import { resolveLiveInningPhaseLabel } from "@shared/matchPhaseDisplay";
import { speakGameVoice, OPERATOR_GAME_VOICE } from "@/lib/gameVoiceAnnouncements";
import { useQueryClient } from "@tanstack/react-query";
import "./managerMatchDetail.css";

const WS_BASE_URL = 'wss://ppamong.com';
const PREDICTION_TOGGLE_MS = 1000;
const RESULT_BUTTONS = ["1루", "2루", "3루", "홈런", "아웃"] as const;

interface Match {
  id: string;
  name: string;
  stadiumId: number;
  startTime: string;
  endTime: string;
  matchStatus: string;
  currentRound: number;
  predictionEnabled: boolean;
  predictionStartTime?: string;
  predictionStopTime?: string;
  gameInning?: number;
  inningHalf?: string;
  batterIndexInHalf?: number;
  outsInHalf?: number;
  needsResultBeforeAdvance?: boolean;
  /** 결과 전송 후 다음 타자/공수교대 대기 */
  needsAdvanceAfterResult?: boolean;
  showThreeOutsHint?: boolean;
  isResultSent?: boolean;
  pinchHitter?: {
    playerName?: string;
    batterIndexInHalf?: number;
  } | null;
  apiSportsAwayTeam?: string | null;
  apiSportsHomeTeam?: string | null;
  liveScoreboard?: {
    awayTeamName?: string;
    homeTeamName?: string;
  } | null;
  matchLineup?: {
    home?: Array<{ battingOrder: number; name: string; playerId?: number }>;
    away?: Array<{ battingOrder: number; name: string; playerId?: number }>;
    source?: string;
  } | null;
  matchPlayerStats?: Record<
    string,
    {
      battingAverage?: string | null;
      hits?: number | null;
      homeRuns?: number | null;
      rbi?: number | null;
      ops?: string | null;
    }
  > | null;
  stadium: {
    id: number;
    name: string;
  };
}

export default function MatchDetailPage() {
  const [, setLocation] = useLocation();
  const { id } = useParams<{ id: string }>();
  const { assets } = useManagerAssets();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [match, setMatch] = useState<Match | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  const [adElapsedTime, setAdElapsedTime] = useState(0);
  const adStartTimeRef = useRef<number | null>(null);
  const [isStartingPrediction, setIsStartingPrediction] = useState(false);
  const [isStoppingPrediction, setIsStoppingPrediction] = useState(false);
  const [isNextBatterLoading, setIsNextBatterLoading] = useState(false);
  const [startToggleAt, setStartToggleAt] = useState(0);
  const [toggleTick, setToggleTick] = useState(0);
  const [showPredictionDisabledPopup, setShowPredictionDisabledPopup] =
    useState(false);
  const [showAdPlayingPopup, setShowAdPlayingPopup] = useState(false);
  const [lineupEditorSide, setLineupEditorSide] = useState<LineupSide | null>(null);
  const [pinchEditorOpen, setPinchEditorOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [managerId, setManagerId] = useState<string | null>(null);
  const { data: scoreboardPayload } = useLiveScoreboard(id ?? null, {
    startTime: match?.startTime,
    matchStatus: match?.matchStatus,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectFnRef = useRef<(() => void | Promise<void>) | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const RECONNECT_DELAY = 1000;
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pongTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionExpiredRef = useRef(false);
  const duplicateLoginRef = useRef(false);
  const isUnmountingRef = useRef(false);
  const threeOutsSpokenRef = useRef(false);
  const matchEndedLogoutRef = useRef(false);
  const HEARTBEAT_INTERVAL = 25000; // 25초마다 ping
  const PONG_TIMEOUT = 10000; // 10초 내 pong 없으면 재연결

  /** Android — 경기 운영 중 시스템 내비·뒤로가기 숨김 + 화면 꺼짐 방지 */
  useEffect(() => {
    void setGameImmersiveMode(true);
    void setGameKeepAwake(true);

    let resumeHandle: { remove: () => void } | null = null;
    if (Capacitor.isNativePlatform()) {
      void App.addListener("appStateChange", ({ isActive }) => {
        if (isActive && window.location.pathname.startsWith("/manager/match/")) {
          void setGameImmersiveMode(true);
          void refreshGameKeepAwake();
        }
      }).then((handle) => {
        resumeHandle = handle;
      });
    }

    return () => {
      resumeHandle?.remove();
      void setGameImmersiveMode(false);
      void setGameKeepAwake(false);
    };
  }, [id]);

  /** access 15분 — 5분마다 선제 갱신 + 앱/탭 복귀 시 갱신 */
  useManagerProactiveSessionRefresh(Boolean(id));

  useEffect(() => {
    if (!startToggleAt) return;
    const elapsed = PREDICTION_TOGGLE_MS - (Date.now() - startToggleAt);
    if (elapsed <= 0) {
      setStartToggleAt(0);
      return;
    }
    const timer = setTimeout(() => setToggleTick((n) => n + 1), elapsed);
    return () => clearTimeout(timer);
  }, [startToggleAt, toggleTick]);

  // 매니저 정보 가져오기
  useEffect(() => {
    const fetchManagerInfo = async () => {
      try {
        const response = await managerFetch("/api/manager/me");
        if (response.ok) {
          const data = await response.json();
          setManagerId(data.manager.id);
        } else {
          toast({
            variant: "destructive",
            description: "매니저 정보를 불러오는데 실패했습니다.",
          });
        }
      } catch (error) {
        console.error("Failed to fetch manager info:", error);
        toast({
          variant: "destructive",
          description: "매니저 정보를 불러오는데 실패했습니다.",
        });
      }
    };
    fetchManagerInfo();
  }, [toast]);

  const logoutOnMatchEnded = useCallback(() => {
    if (matchEndedLogoutRef.current) return;
    matchEndedLogoutRef.current = true;
    toast({
      variant: "destructive",
      description: "담당 경기가 종료되어 로그아웃됩니다.",
    });
    dispatchManagerMatchEnded();
  }, [toast]);

  // WebSocket 연결 및 관리
  useEffect(() => {
    if (!id || !managerId) return;

    const connect = async () => {
      if (
        sessionExpiredRef.current ||
        duplicateLoginRef.current ||
        isUnmountingRef.current
      ) {
        return;
      }

      try {
        await refreshAccessToken();
      } catch (error) {
        console.warn("[Manager WS] 연결 전 토큰 갱신 실패(연결 시도 계속):", error);
      }

      if (
        sessionExpiredRef.current ||
        duplicateLoginRef.current ||
        isUnmountingRef.current
      ) {
        return;
      }

      let wsUrl: string;
      if (Capacitor.isNativePlatform()) {
        const accessToken = getManagerAccessToken();
        wsUrl = `${WS_BASE_URL}/ws/match?matchId=${id}&role=manager&subjectId=${managerId}${accessToken ? `&token=${encodeURIComponent(accessToken)}` : ''}`;
      } else {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        wsUrl = `${protocol}//${window.location.host}/ws/match?matchId=${id}&role=manager&subjectId=${managerId}`;
      }

      console.log("[Manager WS] 연결 시도:", wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[Manager WS] 연결됨");
        setWsConnected(true);
        reconnectAttemptsRef.current = 0;
        sessionExpiredRef.current = false;
        duplicateLoginRef.current = false;
        isUnmountingRef.current = false;
        
        // Heartbeat 시작 - 즉시 첫 ping 전송
        const sendPing = () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
            console.log("[Manager WS] Ping 전송");
            
            // Pong 타임아웃 설정
            if (pongTimeoutRef.current) {
              clearTimeout(pongTimeoutRef.current);
            }
            pongTimeoutRef.current = setTimeout(() => {
              console.log("[Manager WS] Pong 타임아웃, 재연결...");
              ws.close(4000, "heartbeat timeout"); // 4000 코드로 재연결 트리거
            }, PONG_TIMEOUT);
          }
        };
        
        // 즉시 첫 ping 전송
        sendPing();
        
        // 이후 25초마다 ping
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        heartbeatIntervalRef.current = setInterval(sendPing, HEARTBEAT_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const { type, data } = message;

          // Pong 응답 처리 - heartbeat 타임아웃 해제
          if (pongTimeoutRef.current && (type === "pong" || type === "heartbeat_ack")) {
            clearTimeout(pongTimeoutRef.current);
            pongTimeoutRef.current = null;
          }

          switch (type) {
            case "connected":
              console.log("[Manager WS] 서버 연결 확인:", data);
              break;
            case "pong":
            case "heartbeat_ack":
              // Heartbeat 응답 - 별도 처리 불필요
              break;
            case "ad_started":
              console.log("[Manager WS] 광고 시작");
              setIsAdPlaying(true);
              if (data?.adStartedAt) {
                adStartTimeRef.current = data.adStartedAt;
                setAdElapsedTime(Math.max(0, Math.floor((Date.now() - data.adStartedAt) / 1000)));
              } else {
                adStartTimeRef.current = Date.now();
                setAdElapsedTime(0);
              }
              break;
            case "ad_stopped":
              console.log("[Manager WS] 광고 중지");
              setIsAdPlaying(false);
              setAdElapsedTime(0);
              break;
            case "ad_status":
              console.log("[Manager WS] 광고 상태:", data);
              setIsAdPlaying(data?.isAdPlaying || false);
              if (data?.isAdPlaying && data?.adStartedAt) {
                adStartTimeRef.current = data.adStartedAt;
                setAdElapsedTime(Math.max(0, Math.floor((Date.now() - data.adStartedAt) / 1000)));
              }
              break;
            case "round_start":
            case "prediction_started":
              setIsAdPlaying(false);
              setAdElapsedTime(0);
              fetchMatchDetail();
              break;
            case "prediction_cancelled":
              setStartToggleAt(0);
              fetchMatchDetail();
              break;
            case "round_stop":
            case "prediction_stopped":
              fetchMatchDetail();
              break;
            case "round_result":
              fetchMatchDetail();
              break;
            case "round_next":
              fetchMatchDetail();
              break;
            case "pinch_hitter_set":
            case "pinch_hitter_cleared":
              fetchMatchDetail();
              break;
            case "stats_update":
              fetchMatchDetail();
              break;
            case "end":
            case "match_ended":
              logoutOnMatchEnded();
              break;
            default:
              console.log("[Manager WS] 알 수 없는 메시지:", type);
          }
        } catch (error) {
          console.error("[Manager WS] 메시지 파싱 오류:", error);
          toast({
            variant: "destructive",
            description: "실시간 메시지 처리 중 오류가 발생했습니다.",
          });
        }
      };

      ws.onerror = (error) => {
        console.error("[Manager WS] 오류:", error);
      };

      ws.onclose = (event) => {
        console.log("[Manager WS] 연결 종료:", event.code, event.reason);
        setWsConnected(false);
        
        // Heartbeat 타이머 정리
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
        if (pongTimeoutRef.current) {
          clearTimeout(pongTimeoutRef.current);
          pongTimeoutRef.current = null;
        }

        // 세션 종료 (4005) 또는 세션 없음 (4006) - 재시도 없이 즉시 로그인 페이지로
        if (event.code === 4005 || event.code === 4006) {
          if (sessionExpiredRef.current) return;
          sessionExpiredRef.current = true;
          console.log("[Manager WS] 세션 만료/종료, 로그인 페이지로 이동:", event.code);
          window.dispatchEvent(new CustomEvent("manager-session-expired"));
          return;
        }

        // 새 연결로 교체됨 (4004) - 다른 기기에서 로그인
        // 단, 컴포넌트 언마운트로 인한 재연결인 경우 무시
        if (event.code === 4004) {
          if (duplicateLoginRef.current || isUnmountingRef.current) return;
          duplicateLoginRef.current = true;
          console.log("[Manager WS] 다른 기기에서 로그인, 현재 세션 종료");
          window.dispatchEvent(new CustomEvent("manager-duplicate-login"));
          return;
        }

        // 비정상 종료 시 재연결 — 네트워크 끊김으로 토큰 갱신이 실패해도 로그아웃하지 않음
        // (refreshAccessToken이 진짜 인증 만료일 때만 스스로 manager-session-expired 발행)
        if (event.code !== 1000 && event.code !== 1001) {
          // 실시간 채널만 재연결 — HTTP 예측 시작/중지는 WS와 무관하게 동작
          reconnectAttemptsRef.current += 1;
          const attempt = reconnectAttemptsRef.current;
          const delay = Math.min(RECONNECT_DELAY * Math.min(attempt, 10), 15_000);
          console.log(`[Manager WS] 재연결 시도 ${attempt} (${delay}ms)...`);

          reconnectTimeoutRef.current = setTimeout(async () => {
            if (
              sessionExpiredRef.current ||
              duplicateLoginRef.current ||
              isUnmountingRef.current
            ) {
              return;
            }
            try {
              await refreshAccessToken();
            } catch (error) {
              console.warn("[Manager WS] 토큰 갱신 시도 실패(재연결은 계속):", error);
            }
            if (
              sessionExpiredRef.current ||
              duplicateLoginRef.current ||
              isUnmountingRef.current
            ) {
              return;
            }
            void connectFnRef.current?.();
          }, delay);
        }
      };
    };

    // Store connect function in ref for reconnection
    connectFnRef.current = connect;
    void connect();

    return () => {
      // 언마운트 상태 표시 - 4004 코드 발생 시 duplicate login으로 처리하지 않기 위함
      isUnmountingRef.current = true;
      
      // Heartbeat 타이머 정리
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (pongTimeoutRef.current) {
        clearTimeout(pongTimeoutRef.current);
        pongTimeoutRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounted");
      }
    };
  }, [id, managerId, toast, logoutOnMatchEnded]);

  const fetchMatchDetail = useCallback(async (isPolling = false) => {
    try {
      const response = await managerFetch(
        `/api/manager/matches/${id}?_=${Date.now()}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.matchStatus === "completed" || data.matchStatus === "cancelled") {
          logoutOnMatchEnded();
          return;
        }
        setMatch(data);
        if (data.showThreeOutsHint && !threeOutsSpokenRef.current) {
          threeOutsSpokenRef.current = true;
          void speakGameVoice(OPERATOR_GAME_VOICE.threeOuts);
        }
        if (!data.showThreeOutsHint) {
          threeOutsSpokenRef.current = false;
        }
      } else if (response.status === 429) {
        console.log("[Manager] 요청 제한 (429) - 무시하고 기존 데이터 유지");
      } else if (response.status === 403) {
        const data = await response.json();
        if (data.deactivated) {
          toast({
            variant: "destructive",
            description: "비활성화된 계정입니다. 경기 진행이 불가합니다.",
          });
          setLocation("/manager/home");
          return;
        }
        toast({
          variant: "destructive",
          description: data.error || "경기 정보를 불러오는데 실패했습니다.",
        });
        setLocation("/manager/home");
      } else {
        toast({
          variant: "destructive",
          description: "경기 정보를 불러오는데 실패했습니다.",
        });
        setLocation("/manager/home");
      }
    } catch (error) {
      console.error("Failed to fetch match detail:", error);
      if (isPolling) {
        console.log("[Manager] 폴링 중 오류 발생, 기존 데이터 유지");
      } else {
        toast({
          variant: "destructive",
          description: "경기 정보를 불러오는데 실패했습니다.",
        });
        setLocation("/manager/home");
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, toast, setLocation, logoutOnMatchEnded]);

  useEffect(() => {
    if (id) {
      fetchMatchDetail();
    }
  }, [id]);

  // 경기 시작 1분 전부터 MongoDB 폴링 (선택 경기 1건)
  useEffect(() => {
    if (!id || !match?.startTime) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (!shouldClientPollMatch(match.startTime, match.matchStatus)) return;
      console.log("[Manager] 폴링: 경기 정보 갱신");
      fetchMatchDetail(true);
      intervalId = setInterval(() => {
        console.log("[Manager] 폴링: 경기 정보 갱신");
        fetchMatchDetail(true);
      }, 10000);
    };

    if (shouldClientPollMatch(match.startTime, match.matchStatus)) {
      startPolling();
      return () => {
        if (intervalId) clearInterval(intervalId);
      };
    }

    const delay = msUntilMatchPollWindow(match.startTime);
    if (delay == null) return;

    const timerId = setTimeout(startPolling, delay);
    return () => {
      clearTimeout(timerId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [id, match?.startTime, match?.matchStatus, fetchMatchDetail]);

  const handleStartPrediction = async () => {
    if (isStartingPrediction) return;

    const withinStartCancel =
      Boolean(match?.predictionEnabled) &&
      startToggleAt > 0 &&
      Date.now() - startToggleAt < PREDICTION_TOGGLE_MS;

    setIsStartingPrediction(true);
    try {
      const response = await managerFetch(
        withinStartCancel
          ? `/api/manager/matches/${id}/prediction/cancel-start`
          : `/api/manager/matches/${id}/prediction/start`,
        { method: "POST" },
      );

      if (response.ok) {
        setStartToggleAt(withinStartCancel ? 0 : Date.now());
        setIsAdPlaying(false);
        setAdElapsedTime(0);
        if (match) {
          setMatch({
            ...match,
            matchStatus: withinStartCancel ? match.matchStatus : "ongoing",
            predictionEnabled: !withinStartCancel,
            predictionStartTime: withinStartCancel ? undefined : new Date().toISOString(),
            predictionStopTime: undefined,
          });
        }
        if (withinStartCancel) {
          toast({ description: "예측 시작을 취소했습니다." });
        }
        void fetchMatchDetail();
      } else {
        const errorData = await response.json();
        toast({
          variant: "destructive",
          description: errorData.error || "예측 시작 처리에 실패했습니다.",
        });
      }
    } catch (error) {
      console.error("Failed to start/cancel prediction:", error);
      toast({
        variant: "destructive",
        description: "예측 시작 처리에 실패했습니다.",
      });
    } finally {
      setIsStartingPrediction(false);
    }
  };

  const handleStopPrediction = async () => {
    if (isStoppingPrediction) return;

    setIsStoppingPrediction(true);
    try {
      const response = await managerFetch(`/api/manager/matches/${id}/prediction/stop`, {
        method: "POST",
      });

      if (response.ok) {
        if (match) {
          setMatch({
            ...match,
            predictionEnabled: false,
            predictionStopTime: new Date().toISOString(),
            needsResultBeforeAdvance: true,
          });
        }
        void fetchMatchDetail();
      } else {
        const errorData = await response.json();
        toast({
          variant: "destructive",
          description: errorData.error || "예측 중지 처리에 실패했습니다.",
        });
      }
    } catch (error) {
      console.error("Failed to stop prediction:", error);
      toast({
        variant: "destructive",
        description: "예측 중지 처리에 실패했습니다.",
      });
    } finally {
      setIsStoppingPrediction(false);
    }
  };

  const handleResultSelect = (result: string) => {
    if (!match?.predictionStartTime) {
      setShowPredictionDisabledPopup(true);
      return;
    }

    if (match?.predictionEnabled) {
      toast({
        variant: "destructive",
        description: "예측을 먼저 중지해 주세요.",
      });
      return;
    }

    if (selectedResult === result) {
      setSelectedResult(null);
      return;
    }

    setSelectedResult(result);
  };

  const handleConfirmResult = async () => {
    if (!selectedResult || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await managerFetch(`/api/manager/matches/${id}/result`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ result: selectedResult }),
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedResult(null);
        if (data.threeOutsReached) {
          threeOutsSpokenRef.current = true;
          void speakGameVoice(OPERATOR_GAME_VOICE.threeOuts);
          toast({ description: "결과가 전송되었습니다. 공수교대를 눌러주세요." });
        } else {
          toast({ description: "결과가 전송되었습니다. 다음 타자를 눌러주세요." });
        }
        if (match) {
          setMatch({
            ...match,
            // 자동 다음타자 없음 — 라운드 유지, 운영자 버튼 대기
            currentRound: match.currentRound,
            predictionEnabled: false,
            predictionStartTime: undefined,
            predictionStopTime: undefined,
            outsInHalf: data.outsInHalf ?? match.outsInHalf,
            showThreeOutsHint: Boolean(data.threeOutsReached),
            needsResultBeforeAdvance: false,
            needsAdvanceAfterResult: true,
            isResultSent: true,
          });
        }
        void fetchMatchDetail();
      } else {
        const errorData = await response.json();
        toast({
          variant: "destructive",
          description: errorData.error || "결과 전송에 실패했습니다.",
        });
      }
    } catch (error) {
      console.error("Failed to submit result:", error);
      toast({
        variant: "destructive",
        description: "결과 전송에 실패했습니다.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdvanceRound = async (
    path: string,
    failMessage: string,
    options?: { onSuccess?: (data: Record<string, unknown>) => void },
  ) => {
    if (isNextBatterLoading) return;
    if (isAdPlaying) {
      handleStopAd();
      return;
    }
    setIsNextBatterLoading(true);
    try {
      const res = await managerFetch(path, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", description: data.error || failMessage });
        return;
      }
      if (data.adStarted) {
        setIsAdPlaying(true);
        adStartTimeRef.current = Date.now();
        setAdElapsedTime(0);
      }
      options?.onSuccess?.(data);
      await fetchMatchDetail();
    } catch {
      toast({ variant: "destructive", description: failMessage });
    } finally {
      setIsNextBatterLoading(false);
    }
  };

  const handleNextBatter = () => {
    if (match?.showThreeOutsHint) {
      toast({ description: "3아웃입니다. 공수교대를 눌러주세요." });
      return;
    }
    if (match?.needsResultBeforeAdvance) {
      toast({ description: "먼저 예측 결과를 전송해 주세요." });
      return;
    }
    void handleAdvanceRound(
      `/api/manager/control/${id}/round/next-batter`,
      "다음 타자 처리에 실패했습니다.",
    );
  };

  const handlePitcherChange = () => {
    if (match?.showThreeOutsHint && !isAdPlaying) {
      toast({ description: "공수교대 시에는 투수 교체 대신 공수 교대를 사용하세요." });
      return;
    }
    void handleAdvanceRound(
      `/api/manager/control/${id}/round/pitcher-change`,
      "투수 교체 처리에 실패했습니다.",
      {
        onSuccess: () => {
          setStartToggleAt(0);
          setSelectedResult(null);
        },
      },
    );
  };

  const handleSwitchHalf = () => {
    if (match?.needsResultBeforeAdvance) {
      toast({ description: "먼저 예측 결과를 전송해 주세요." });
      return;
    }
    void handleAdvanceRound(
      `/api/manager/control/${id}/round/switch-half`,
      "공수교대 처리에 실패했습니다.",
      {
        onSuccess: () => {
          threeOutsSpokenRef.current = false;
        },
      },
    );
  };

  // 광고 타이머 (서버 시작 시각 기반으로 정확한 경과 시간 계산)
  useEffect(() => {
    if (!isAdPlaying) {
      adStartTimeRef.current = null;
      return;
    }

    if (!adStartTimeRef.current) {
      adStartTimeRef.current = Date.now();
      setAdElapsedTime(0);
    }

    const timer = setInterval(() => {
      if (adStartTimeRef.current) {
        setAdElapsedTime(Math.max(0, Math.floor((Date.now() - adStartTimeRef.current) / 1000)));
      }
    }, 500);

    return () => clearInterval(timer);
  }, [isAdPlaying]);

  const formatAdTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleStopAd = async () => {
    try {
      const response = await managerFetch(`/api/manager/matches/${id}/ad/stop`, {
        method: "POST",
      });
      if (response.ok) {
        setIsAdPlaying(false);
        setAdElapsedTime(0);
      } else {
        const errorData = await response.json();
        toast({
          variant: "destructive",
          description: errorData.error || "광고 중지에 실패했습니다.",
        });
      }
    } catch (error) {
      console.error("Failed to stop ad:", error);
      toast({
        variant: "destructive",
        description: "광고 중지에 실패했습니다.",
      });
    }
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false, // 24시간 형식
    });
  };

  if (isLoading || !match) {
    return (
      <div className="h-[100dvh] bg-white w-full flex flex-col overflow-hidden" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 44px)' }}>
        {/* 헤더 스켈레톤 */}
        <div className="flex-shrink-0 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-4 w-12 bg-gray-200 rounded animate-pulse"></div>
          </div>
          <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
        </div>

        {/* 메인 컨텐츠 스켈레톤 */}
        <div className="px-4 py-6">
          {/* 날짜 및 제목 스켈레톤 */}
          <div className="flex flex-col items-center gap-1.5 mb-6">
            <div className="h-3.5 w-48 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse"></div>
          </div>

          {/* 경기장 정보 스켈레톤 */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="h-4 w-20 bg-gray-200 rounded mb-2 animate-pulse"></div>
            <div className="h-5 w-40 bg-gray-200 rounded animate-pulse"></div>
          </div>

          {/* 예측 시간 정보 스켈레톤 */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3">
            <div className="flex justify-between">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="flex justify-between">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>

          {/* 버튼 스켈레톤 */}
          <div className="space-y-3">
            <div className="h-12 w-full bg-gray-200 rounded-lg animate-pulse"></div>
            <div className="h-12 w-full bg-gray-200 rounded-lg animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  const today = new Date();
  const formattedDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 (${["일", "월", "화", "수", "목", "금", "토"][today.getDay()]})`;
  const displayStadiumName = getDisplayStadiumName(match.stadium.name);
  const { awayTeamName, homeTeamName } = resolveMatchTeamNames({
    apiSportsAwayTeam: match.apiSportsAwayTeam,
    apiSportsHomeTeam: match.apiSportsHomeTeam,
    liveScoreboard: match.liveScoreboard ?? scoreboardPayload?.scoreboard ?? null,
  });
  const matchPhaseText = resolveLiveInningPhaseLabel({
    matchStatus: match.matchStatus,
    gameInning: match.gameInning,
    inningHalf: match.inningHalf,
    scoreboard: scoreboardPayload?.scoreboard ?? null,
  });
  const blockAdvance = Boolean(match.needsResultBeforeAdvance);
  const awaitAdvanceAfterResult = Boolean(
    match.needsAdvanceAfterResult || match.isResultSent,
  );
  const showThreeOutsHint = Boolean(match.showThreeOutsHint);
  /** 경기중(ongoing) 또는 시작 시각 경과(API 지연으로 scheduled 잔류) */
  const startTimeReached = Boolean(
    match.startTime && Number.isFinite(new Date(match.startTime).getTime())
      ? Date.now() >= new Date(match.startTime).getTime()
      : false,
  );
  const isMatchLive =
    match.matchStatus === "ongoing" ||
    (match.matchStatus === "scheduled" && startTimeReached);
  const predictionRunning = Boolean(match.predictionEnabled);
  const withinStartCancel =
    predictionRunning &&
    startToggleAt > 0 &&
    Date.now() - startToggleAt < PREDICTION_TOGGLE_MS;
  /** 결과 후·3아웃에는 예측 시작 불가 — 다음 타자/공수교대만 */
  const canStartPrediction =
    isMatchLive &&
    !showThreeOutsHint &&
    !awaitAdvanceAfterResult &&
    !isStartingPrediction &&
    (!predictionRunning || withinStartCancel);
  const canStopPrediction = isMatchLive && !isStoppingPrediction && predictionRunning;
  /** 예측 중지 후·결과 전송 전에만 결과 선택 가능 */
  const canSelectResult =
    isMatchLive &&
    !predictionRunning &&
    Boolean(match.predictionStopTime) &&
    blockAdvance;
  const blockAdvanceActions = blockAdvance || predictionRunning;
  /** 공수교대(3아웃) 제외 — 예측 시작·중지 중에도 투수 교체 가능 */
  const canPitcherChange =
    (isMatchLive && !showThreeOutsHint && !isNextBatterLoading) || isAdPlaying;
  /** 다음 타자 — 3아웃이면 공수교대만; 결과 대기 중에는 다음타자 가능 */
  const canNextBatter =
    (isMatchLive &&
      !showThreeOutsHint &&
      !isNextBatterLoading &&
      !blockAdvanceActions) ||
    isAdPlaying;
  /** 공수 교대 — 결과 대기 중이 아니어야 함(미결과면 먼저 결과) */
  const canSwitchHalf =
    (isMatchLive && !isNextBatterLoading && !blockAdvanceActions) || isAdPlaying;
  /** 대타 — 경기중·예측 중이 아닐 때 (현재 타석 교체) */
  const canSetPinchHitter =
    isMatchLive && !isNextBatterLoading && !predictionRunning && !isAdPlaying;

  return (
    <div className="manager-match-shell bg-white w-full" data-testid="manager-match-detail">
      <div className="manager-match-body">
        <header className="manager-match-header">
          <p className="manager-match-date" data-testid="text-match-date">
            {formattedDate}
          </p>
          <h1 className="manager-match-title" data-testid="text-match-name">
            {match.name}
          </h1>
        </header>

        <div className="manager-match-info">
          {displayStadiumName && (
            <>
              <img src={assets.stadiumIcon} alt="" className="w-4 h-4 shrink-0" />
              <span data-testid="text-stadium-name">{displayStadiumName}</span>
              <span className="text-gray-300">·</span>
            </>
          )}
          <span data-testid="text-match-status">{matchPhaseText}</span>
        </div>

        <div className="manager-match-score">
          <ManagerOperatorScorePanel
            scoreboard={scoreboardPayload?.scoreboard ?? null}
            gameInning={match.gameInning}
            inningHalf={match.inningHalf}
            matchStatus={match.matchStatus}
            controlMode={scoreboardPayload?.controlMode}
            awayLineupCount={match.matchLineup?.away?.length ?? 0}
            homeLineupCount={match.matchLineup?.home?.length ?? 0}
            awayTeamFallback={awayTeamName}
            homeTeamFallback={homeTeamName}
            onTeamClick={(side) => setLineupEditorSide(side)}
            onSaveScores={async ({ awayScore, homeScore }) => {
              if (!id) return;
              try {
                const res = await managerFetch(`/api/manager/matches/${id}/scoreboard`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    awayScore,
                    homeScore,
                    lockManual: true,
                    syncOperatorPhase: false,
                    inning: match.gameInning ?? undefined,
                    inningHalf:
                      match.inningHalf === "bottom" || match.inningHalf === "top"
                        ? match.inningHalf
                        : undefined,
                  }),
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  throw new Error(
                    typeof err?.error === "string" ? err.error : "스코어보드 보정에 실패했습니다.",
                  );
                }
                await queryClient.invalidateQueries({
                  queryKey: ["/api/matches", id, "scoreboard"],
                });
                toast({
                  description: "점수를 보정했습니다. TV 기준으로 잠갔습니다.",
                });
              } catch (err: unknown) {
                toast({
                  variant: "destructive",
                  description: err instanceof Error ? err.message : "스코어보드 보정에 실패했습니다.",
                });
                throw err;
              }
            }}
            onResumeAuto={async () => {
              if (!id) return;
              try {
                const res = await managerFetch(`/api/manager/matches/${id}/scoreboard`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    lockManual: false,
                    syncOperatorPhase: false,
                  }),
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  throw new Error(
                    typeof err?.error === "string" ? err.error : "자동 반영 전환에 실패했습니다.",
                  );
                }
                await queryClient.invalidateQueries({
                  queryKey: ["/api/matches", id, "scoreboard"],
                });
                toast({ description: "API 점수 자동 반영을 다시 켰습니다." });
              } catch (err: unknown) {
                toast({
                  variant: "destructive",
                  description: err instanceof Error ? err.message : "자동 반영 전환에 실패했습니다.",
                });
              }
            }}
          />
          {scoreboardPayload?.controlMode === "manual" && (
            <p className="mt-1 text-[clamp(9px,2.2vw,11px)] text-red-600 font-medium leading-snug">
              비상 수동 제어 (점수 API 잠금)
            </p>
          )}
          <p className="mt-1 text-[clamp(9px,2.2vw,11px)] text-gray-500 leading-snug">
            팀 이름을 눌러 주전 타순·시즌 전적을 입력하세요.
          </p>
        </div>

        <div className="manager-match-controls">
          <div className="manager-match-control-col">
            <h3 className="manager-match-section-title">예측 시작</h3>
            <button
              type="button"
              onClick={handleStartPrediction}
              disabled={!canStartPrediction}
              data-testid="button-start-prediction"
              className={`manager-match-action-btn bg-[#1A6DFF] relative z-20 ${
                withinStartCancel ? "manager-match-action-btn--toggle" : ""
              }`}
            >
              {!isMatchLive
                ? "경기전"
                : isStartingPrediction
                  ? "처리중..."
                  : withinStartCancel
                    ? "↩ 시작 취소"
                    : predictionRunning
                      ? "예측 중"
                      : "▶ 예측 시작"}
              <img
                src={assets.startPrediction}
                className="manager-match-action-mascot w-[52px] h-[94px] object-contain -top-3 -right-1 scale-x-[-1]"
                alt=""
              />
            </button>
            <div
              className="manager-match-time-box text-[#1A6DFF]"
              data-testid="text-prediction-start-time"
            >
              {/* 경기전(scheduled)에는 잔여 RoundStatistics 시각을 숨김 */}
              {isMatchLive && match?.predictionStartTime
                ? formatTime(match.predictionStartTime)
                : "-"}
            </div>
          </div>

          <div className="manager-match-control-col">
            <h3 className="manager-match-section-title">예측 중지</h3>
            <button
              type="button"
              onClick={handleStopPrediction}
              disabled={!canStopPrediction}
              data-testid="button-stop-prediction"
              className="manager-match-action-btn bg-[#E11936] relative z-20"
            >
              {!isMatchLive
                ? "경기전"
                : isStoppingPrediction
                  ? "처리중..."
                  : "■ 예측 중지"}
              <img
                src={assets.stopPrediction}
                className="manager-match-action-mascot w-[64px] h-[86px] object-contain -top-6 -left-1 scale-x-[-1]"
                alt=""
              />
            </button>
            <div
              className="manager-match-time-box text-[#E11936]"
              data-testid="text-prediction-stop-time"
            >
              {isMatchLive && match?.predictionStopTime
                ? formatTime(match.predictionStopTime)
                : "-"}
            </div>
          </div>
        </div>

        <div className="manager-match-results">
          <h3 className="manager-match-section-title">예측 결과</h3>
          <div className="manager-match-result-grid">
            {RESULT_BUTTONS.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => handleResultSelect(label)}
                disabled={!canSelectResult}
                data-testid={`button-result-${label}`}
                className={`manager-match-result-btn ${
                  selectedResult === label ? "manager-match-result-btn--selected" : ""
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleConfirmResult}
            disabled={!selectedResult || !canSelectResult || isSubmitting}
            data-testid="button-confirm-result"
            className="manager-match-result-confirm"
          >
            {isSubmitting
              ? "전송 중..."
              : selectedResult
                ? `「${selectedResult}」 결과 전송 확인`
                : "결과를 선택한 뒤 확인"}
          </button>
        </div>

        <footer className="manager-match-footer">
          {!wsConnected && (
            <div
              className="manager-match-notice"
              data-testid="ws-reconnect-notice"
              style={{ background: "#FFF3CD", color: "#856404" }}
            >
              실시간 연결 재시도 중… 예측 시작·중지는 계속 사용할 수 있습니다.
            </div>
          )}

          {isAdPlaying && (
            <div className="manager-match-notice manager-match-notice--ad" data-testid="ad-timer">
              <span>광고 재생중</span>
              <span className="text-[#E11936]">{formatAdTime(adElapsedTime)}</span>
            </div>
          )}

          {showThreeOutsHint && (
            <div
              className="manager-match-notice manager-match-notice--three-outs"
              data-testid="text-three-outs-hint"
            >
              3아웃 — 공수교대를 눌러주세요
            </div>
          )}

          {!showThreeOutsHint && awaitAdvanceAfterResult && (
            <div
              className="manager-match-notice"
              data-testid="text-await-next-batter"
              style={{ background: "#E8F5E9", color: "#2E7D32" }}
            >
              결과 전송됨 — 다음 타자를 눌러주세요
            </div>
          )}

          <div className="manager-match-bottom-grid">
            <button
              type="button"
              onClick={() => (isAdPlaying ? handleStopAd() : handleNextBatter())}
              disabled={!canNextBatter}
              data-testid="button-next-batter"
              className="manager-match-bottom-btn bg-[#4285F4]"
            >
              {isNextBatterLoading ? "처리중" : "다음\n타자"}
            </button>
            <button
              type="button"
              onClick={() => (isAdPlaying ? handleStopAd() : handleSwitchHalf())}
              disabled={!canSwitchHalf}
              data-testid="button-switch-half"
              className={`manager-match-bottom-btn ${
                isAdPlaying ? "bg-[#2A2D2E]" : "bg-[#E11936]"
              } ${showThreeOutsHint && !isAdPlaying ? "manager-match-bottom-btn--pulse" : ""}`}
            >
              {isAdPlaying ? "광고\n종료" : isNextBatterLoading ? "처리중" : "공수\n교대"}
            </button>
            <button
              type="button"
              onClick={() => (isAdPlaying ? handleStopAd() : handlePitcherChange())}
              disabled={!canPitcherChange}
              data-testid="button-pitcher-change"
              className="manager-match-bottom-btn bg-[#5C6BC0]"
            >
              {isNextBatterLoading ? "처리중" : "투수\n교체"}
            </button>
            <button
              type="button"
              onClick={() => setPinchEditorOpen(true)}
              disabled={!canSetPinchHitter}
              data-testid="button-pinch-hitter"
              className="manager-match-bottom-btn bg-[#00897B]"
            >
              {match.pinchHitter?.playerName
                ? `대타\n${match.pinchHitter.playerName}`
                : "대타"}
            </button>
          </div>
        </footer>
      </div>

      {/* 예측 미시작 안내 팝업 */}
      {showPredictionDisabledPopup && (
        <AdminConfirmPopup
          title="안내"
          message="예측을 먼저 시작해주세요."
          cancelText=""
          confirmText="확인"
          onCancel={() => setShowPredictionDisabledPopup(false)}
          onConfirm={() => setShowPredictionDisabledPopup(false)}
        />
      )}

      {/* 광고 재생중 안내 팝업 */}
      {showAdPlayingPopup && (
        <AdminConfirmPopup
          title="안내"
          message="광고 재생중입니다."
          cancelText=""
          confirmText="확인"
          onCancel={() => setShowAdPlayingPopup(false)}
          onConfirm={() => setShowAdPlayingPopup(false)}
        />
      )}

      {lineupEditorSide && id ? (
        <ManagerLineupEditor
          matchId={id}
          awayTeamLabel={awayTeamName}
          homeTeamLabel={homeTeamName}
          initialSide={lineupEditorSide}
          seasonYear={
            match.startTime ? new Date(match.startTime).getFullYear() : new Date().getFullYear()
          }
          initialLineup={match.matchLineup}
          initialStats={match.matchPlayerStats}
          onClose={() => setLineupEditorSide(null)}
          onSaved={() => {
            void fetchMatchDetail();
            void queryClient.invalidateQueries({
              queryKey: ["/api/matches", id, "scoreboard"],
            });
          }}
        />
      ) : null}

      {pinchEditorOpen && id ? (
        <ManagerPinchHitterEditor
          matchId={id}
          seasonYear={
            match.startTime ? new Date(match.startTime).getFullYear() : new Date().getFullYear()
          }
          batterOrderLabel={
            match.batterIndexInHalf != null ? `${match.batterIndexInHalf}번째 타자` : undefined
          }
          onClose={() => setPinchEditorOpen(false)}
          onSaved={() => {
            void fetchMatchDetail();
            void queryClient.invalidateQueries({
              queryKey: ["/api/matches", id, "scoreboard"],
            });
          }}
        />
      ) : null}
    </div>
  );
}
