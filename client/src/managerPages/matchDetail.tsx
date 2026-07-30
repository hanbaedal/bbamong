import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import AdminConfirmPopup from "@/components/customUi/AdminConfirmPopup";
import { managerFetch, refreshAccessToken } from "@/lib/managerQueryClient";
import { getManagerAccessToken } from "@/lib/managerTokenManager";
import { useManagerAssets } from "@/contexts/ManagerAssetContext";
import { useToast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";
import LiveScoreboard from "@/components/LiveScoreboard";
import { useLiveScoreboard } from "@/hooks/useLiveScoreboard";
import { shouldClientPollMatch, msUntilMatchPollWindow } from "@/lib/matchPollWindow";
import { getDisplayStadiumName } from "@shared/stadiumDisplay";
import { formatMatchInningPhase } from "@shared/matchPhaseDisplay";
import { speakGameVoice, OPERATOR_GAME_VOICE } from "@/lib/gameVoiceAnnouncements";
import "./managerMatchDetail.css";

const WS_BASE_URL = 'wss://ppamong.com';

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
  outsInHalf?: number;
  needsResultBeforeAdvance?: boolean;
  showThreeOutsHint?: boolean;
  isResultSent?: boolean;
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
  const [match, setMatch] = useState<Match | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  const [adElapsedTime, setAdElapsedTime] = useState(0);
  const adStartTimeRef = useRef<number | null>(null);
  const [isStartingPrediction, setIsStartingPrediction] = useState(false);
  const [isStoppingPrediction, setIsStoppingPrediction] = useState(false);
  const [isNextBatterLoading, setIsNextBatterLoading] = useState(false);
  const [lastAdvanceSkippedResult, setLastAdvanceSkippedResult] = useState(false);
  const [showPredictionDisabledPopup, setShowPredictionDisabledPopup] =
    useState(false);
  const [showAdPlayingPopup, setShowAdPlayingPopup] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [managerId, setManagerId] = useState<string | null>(null);
  const { data: scoreboardPayload } = useLiveScoreboard(id ?? null, {
    startTime: match?.startTime,
    matchStatus: match?.matchStatus,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectFnRef = useRef<(() => void) | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 30;
  const RECONNECT_DELAY = 1000;
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pongTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionExpiredRef = useRef(false);
  const duplicateLoginRef = useRef(false);
  const isUnmountingRef = useRef(false);
  const threeOutsSpokenRef = useRef(false);
  const HEARTBEAT_INTERVAL = 25000; // 25초마다 ping
  const PONG_TIMEOUT = 10000; // 10초 내 pong 없으면 재연결

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

  // WebSocket 연결 및 관리
  useEffect(() => {
    if (!id || !managerId) return;

    const connect = () => {
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
            case "stats_update":
              fetchMatchDetail();
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

        // 비정상 종료 시 재연결 시도
        if (event.code !== 1000 && event.code !== 1001) {
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current += 1;
            console.log(`[Manager WS] 재연결 시도 ${reconnectAttemptsRef.current}/${maxReconnectAttempts}...`);
            
            reconnectTimeoutRef.current = setTimeout(async () => {
              try {
                const refreshed = await refreshAccessToken();
                
                if (refreshed) {
                  console.log("[Manager WS] 토큰 갱신 성공, 재연결 시도");
                  if (connectFnRef.current) {
                    connectFnRef.current();
                  }
                } else {
                  if (sessionExpiredRef.current) return;
                  sessionExpiredRef.current = true;
                  console.log("[Manager WS] 토큰 갱신 실패, 세션 만료");
                  window.dispatchEvent(new CustomEvent("manager-session-expired"));
                }
              } catch (error) {
                if (sessionExpiredRef.current) return;
                sessionExpiredRef.current = true;
                console.error("[Manager WS] 토큰 갱신 오류:", error);
                window.dispatchEvent(new CustomEvent("manager-session-expired"));
              }
            }, RECONNECT_DELAY);
          } else {
            console.error("[Manager WS] 최대 재연결 시도 횟수 초과");
            if (!sessionExpiredRef.current) {
              toast({
                variant: "destructive",
                description: "실시간 연결에 실패했습니다. 페이지를 새로고침해주세요.",
              });
            }
          }
        }
      };
    };

    // Store connect function in ref for reconnection
    connectFnRef.current = connect;
    connect();

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
  }, [id, managerId, toast]);

  const fetchMatchDetail = useCallback(async (isPolling = false) => {
    try {
      const response = await managerFetch(
        `/api/manager/matches/${id}?_=${Date.now()}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.matchStatus === "completed") {
          toast({
            variant: "destructive",
            description: "종료된 경기입니다.",
          });
          setLocation("/manager/home");
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
  }, [id, toast, setLocation]);

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

    setIsStartingPrediction(true);
    try {
      const response = await managerFetch(
        `/api/manager/matches/${id}/prediction/start`,
        {
          method: "POST",
        },
      );

      if (response.ok) {
        setIsAdPlaying(false);
        setAdElapsedTime(0);
        setLastAdvanceSkippedResult(false);
        if (match) {
          setMatch({
            ...match,
            predictionEnabled: true,
            predictionStartTime: new Date().toISOString(),
            predictionStopTime: undefined,
          });
        }
      } else {
        const errorData = await response.json();
        toast({
          variant: "destructive",
          description: errorData.error || "예측 시작에 실패했습니다.",
        });
      }
    } catch (error) {
      console.error("Failed to start prediction:", error);
      toast({
        variant: "destructive",
        description: "예측 시작에 실패했습니다.",
      });
    } finally {
      setIsStartingPrediction(false);
    }
  };

  const handleStopPrediction = async () => {
    if (isStoppingPrediction) return;

    setIsStoppingPrediction(true);
    try {
      const response = await managerFetch(
        `/api/manager/matches/${id}/prediction/stop`,
        {
          method: "POST",
        },
      );

      if (response.ok) {
        if (match) {
          setMatch({
            ...match,
            predictionEnabled: false,
            predictionStopTime: new Date().toISOString(),
          });
        }
      } else {
        const errorData = await response.json();
        toast({
          variant: "destructive",
          description: errorData.error || "예측 중지에 실패했습니다.",
        });
      }
    } catch (error) {
      console.error("Failed to stop prediction:", error);
      toast({
        variant: "destructive",
        description: "예측 중지에 실패했습니다.",
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

    setSelectedResult(result);
    setShowConfirmPopup(true);
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
        setShowConfirmPopup(false);
        setSelectedResult(null);
        setLastAdvanceSkippedResult(false);
        if (data.threeOutsReached) {
          threeOutsSpokenRef.current = true;
          void speakGameVoice(OPERATOR_GAME_VOICE.threeOuts);
        }
        if (match) {
          setMatch({
            ...match,
            currentRound: data.nextRound ?? match.currentRound + 1,
            predictionEnabled: false,
            predictionStartTime: undefined,
            predictionStopTime: undefined,
            outsInHalf: data.outsInHalf ?? match.outsInHalf,
            showThreeOutsHint: Boolean(data.threeOutsReached),
            needsResultBeforeAdvance: false,
            isResultSent: true,
          });
        }
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

  const handleCancelResult = () => {
    setShowConfirmPopup(false);
    setSelectedResult(null);
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
      setLastAdvanceSkippedResult(true);
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
    if (match?.needsResultBeforeAdvance) {
      toast({ description: "먼저 예측 결과를 전송해 주세요." });
      return;
    }
    void handleAdvanceRound(
      `/api/manager/control/${id}/round/next-batter`,
      "다음 타자 처리에 실패했습니다.",
    );
  };

  const handlePitcherChange = () =>
    void handleAdvanceRound(
      `/api/manager/control/${id}/round/pitcher-change`,
      "투수 교체 처리에 실패했습니다.",
    );

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
  const matchPhaseText = formatMatchInningPhase({
    matchStatus: match.matchStatus,
    gameInning: match.gameInning,
    inningHalf: match.inningHalf,
  });
  const blockAdvance = Boolean(match.needsResultBeforeAdvance);
  const showThreeOutsHint = Boolean(match.showThreeOutsHint);

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
          <LiveScoreboard
            scoreboard={scoreboardPayload?.scoreboard ?? null}
            dense
            showTeamNames={false}
          />
          {scoreboardPayload?.controlMode === "manual" && (
            <p className="mt-0.5 text-[10px] text-red-600 font-medium leading-tight">
              비상 수동 제어
            </p>
          )}
        </div>

        <div className="manager-match-controls">
          <div className="manager-match-control-col">
            <h3 className="manager-match-section-title">예측 시작</h3>
            <button
              type="button"
              onClick={handleStartPrediction}
              disabled={isStartingPrediction || !wsConnected}
              data-testid="button-start-prediction"
              className="manager-match-action-btn bg-[#1A6DFF] relative z-20"
            >
              {!wsConnected ? "연결 중..." : isStartingPrediction ? "처리중..." : "▶ 예측 시작"}
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
              {match?.predictionStartTime ? formatTime(match.predictionStartTime) : "-"}
            </div>
          </div>

          <div className="manager-match-control-col">
            <h3 className="manager-match-section-title">예측 중지</h3>
            <button
              type="button"
              onClick={handleStopPrediction}
              disabled={isStoppingPrediction || !wsConnected}
              data-testid="button-stop-prediction"
              className="manager-match-action-btn bg-[#E11936] relative z-20"
            >
              {!wsConnected ? "연결 중..." : isStoppingPrediction ? "처리중..." : "■ 예측 중지"}
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
              {match?.predictionStopTime ? formatTime(match.predictionStopTime) : "-"}
            </div>
          </div>
        </div>

        <div className="manager-match-results">
          <h3 className="manager-match-section-title">예측 결과</h3>
          <div className="manager-match-result-row">
            {["1루", "2루", "3루", "홈런", "아웃"].map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => handleResultSelect(label)}
                disabled={!wsConnected || !!match?.predictionEnabled}
                data-testid={`button-result-${label}`}
                className={`manager-match-result-btn ${
                  selectedResult === label ? "manager-match-result-btn--selected" : ""
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <footer className="manager-match-footer">
          {isAdPlaying && (
            <div className="manager-match-notice manager-match-notice--ad" data-testid="ad-timer">
              <span>광고 재생중</span>
              <span className="text-[#E11936]">{formatAdTime(adElapsedTime)}</span>
            </div>
          )}

          {lastAdvanceSkippedResult && (
            <div
              className="manager-match-notice manager-match-notice--skip"
              data-testid="text-skipped-result-notice"
            >
              결과 생략됨
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

          <div className="manager-match-bottom-grid">
            <button
              type="button"
              onClick={() => (isAdPlaying ? handleStopAd() : handleNextBatter())}
              disabled={
                isNextBatterLoading ||
                (!wsConnected && !isAdPlaying) ||
                (blockAdvance && !isAdPlaying)
              }
              data-testid="button-next-batter"
              className="manager-match-bottom-btn bg-[#4285F4]"
            >
              {isNextBatterLoading ? "처리중..." : "다음 타자"}
            </button>
            <button
              type="button"
              onClick={() => (isAdPlaying ? handleStopAd() : handlePitcherChange())}
              disabled={isNextBatterLoading || (!wsConnected && !isAdPlaying)}
              data-testid="button-pitcher-change"
              className="manager-match-bottom-btn bg-[#5C6BC0]"
            >
              {isNextBatterLoading ? "처리중..." : "투수 교체"}
            </button>
            <button
              type="button"
              onClick={() => (isAdPlaying ? handleStopAd() : handleSwitchHalf())}
              disabled={
                isNextBatterLoading ||
                (!wsConnected && !isAdPlaying) ||
                (blockAdvance && !isAdPlaying)
              }
              data-testid="button-switch-half"
              className={`manager-match-bottom-btn ${
                isAdPlaying ? "bg-[#2A2D2E]" : "bg-[#E11936]"
              } ${showThreeOutsHint && !isAdPlaying ? "manager-match-bottom-btn--pulse" : ""}`}
            >
              {isAdPlaying ? "광고 종료" : isNextBatterLoading ? "처리중..." : "공수 교대"}
            </button>
          </div>
        </footer>
      </div>

      {/* 결과 확인 팝업 */}
      {showConfirmPopup && selectedResult && (
        <AdminConfirmPopup
          title="예측 결과 전송"
          message={`예측 결과를 "${selectedResult}"로 전송하시겠습니까?`}
          cancelText="취소"
          confirmText="확인"
          onCancel={handleCancelResult}
          onConfirm={handleConfirmResult}
        />
      )}

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
    </div>
  );
}
