import { useState, useEffect, useRef, useMemo, useCallback, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import AdminLayout from "../adminLayout";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import AdminConfirmPopup from "@/components/customUi/AdminConfirmPopup";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/adminQueryClient";
import LiveScoreboard from "@/components/LiveScoreboard";
import { useApiSportsHealth, useLiveScoreboard } from "@/hooks/useLiveScoreboard";

interface Match {
  id: string;
  name: string;
  stadiumId: number;
  startTime: string;
  endTime: string;
  matchStatus: string;
  currentRound: number;
  controlMode?: string;
}

interface OverallStats {
  totalPredictors: number;
  totalPredictionPoints: number;
  currentRound: number;
  totalWinners: number;
  totalDistributedPoints: number;
  currentRoundParticipants: number;
  currentRoundPoints: number;
  predictionEnabled: boolean;
}

interface RoundDetail {
  roundNumber: number;
  totalParticipants: number;
  totalPoints: number;
  totalWinners: number;
  result: string | null;
  distributedPoints: number;
}

function MonitoringStatCard({
  label,
  value,
  accent,
  transitioning,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  transitioning?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[#E9E9E9] bg-white px-4 py-3 min-w-0">
      <p className="text-xs text-[#888] truncate">{label}</p>
      <p
        className={`text-lg font-bold mt-1 tabular-nums transition-all duration-300 ${
          transitioning ? "opacity-0 -translate-y-1" : "opacity-100 translate-y-0"
        } ${accent ? "text-[#E11936]" : "text-[#201E22]"}`}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

function MonitoringSection({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[10px] border border-[#E9E9E9] bg-white overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[#F0F0F0] bg-[#FAFAFA]">
        <h3 className="text-sm font-semibold text-[#201E22]">{title}</h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function formatDateKey(dateKey: string) {
  const [y, m, d] = dateKey.split("-");
  if (!y || !m || !d) return dateKey;
  return `${y}. ${m}. ${d}`;
}

export default function RealtimeGameMonitoring() {
  const [, params] = useRoute("/admin/match-monitoring/:dateKey");
  const { assets } = useAdminAssets();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // URL에서 matchIndex 파라미터 읽기
  const getInitialMatchIndex = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const matchIndexParam = searchParams.get("matchIndex");
    if (matchIndexParam !== null) {
      const index = parseInt(matchIndexParam, 10);
      if (!isNaN(index) && index >= 0) {
        return index;
      }
    }
    return 0;
  };

  const [selectedMatchIndex, setSelectedMatchIndex] =
    useState(getInitialMatchIndex);
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null);
  const [roundDetails, setRoundDetails] = useState<RoundDetail[]>([]);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [showIncompleteRoundsWarning, setShowIncompleteRoundsWarning] = useState(false);
  const [incompleteRoundsInfo, setIncompleteRoundsInfo] = useState<{
    predictionActive: boolean;
    roundsWithoutResult: number[];
  } | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [localMatchStatus, setLocalMatchStatus] = useState<string | null>(null);
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  const [adElapsedTime, setAdElapsedTime] = useState(0);
  const [isAdLoading, setIsAdLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef<number>(0);
  const maxReconnectAttempts = 30;
  const RECONNECT_DELAY = 1000;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pongTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountingRef = useRef(false);
  const isConnectingRef = useRef(false);
  const currentMatchIdRef = useRef<string | null>(null);
  
  const HEARTBEAT_INTERVAL = 25000;
  const PONG_TIMEOUT = 10000;

  // 모든 경기 조회
  const { data: matchesData } = useQuery<Match[]>({
    queryKey: ["/api/admin/matches"],
  });

  // 날짜별로 그룹화된 경기 가져오기 (matchDate 필드 우선 사용)
  const groupedMatches =
    matchesData?.reduce(
      (acc, match) => {
        const matchWithDate = match as Match & { matchDate?: string | null };
        // matchDate 필드 우선 사용, 없으면 startTime에서 UTC 날짜 추출
        let dateKey: string;
        if (matchWithDate.matchDate) {
          dateKey = matchWithDate.matchDate;
        } else {
          // 레거시 데이터: startTime에서 KST 날짜 추출
          const utcDate = new Date(match.startTime);
          const kstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
          dateKey = `${kstDate.getUTCFullYear()}-${String(kstDate.getUTCMonth() + 1).padStart(2, "0")}-${String(kstDate.getUTCDate()).padStart(2, "0")}`;
        }

        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }
        acc[dateKey].push(match);
        return acc;
      },
      {} as Record<string, Match[]>,
    ) || {};

  // 현재 날짜의 경기들 (name에서 숫자 추출하여 정렬)
  const currentDateMatches = useMemo(() => {
    const matches = params?.dateKey ? groupedMatches[params.dateKey] || [] : [];

    // name에서 숫자를 추출하여 정렬 (예: "1경기", "2경기", "10경기")
    return matches.sort((a, b) => {
      const numA = parseInt(a.name.match(/\d+/)?.[0] || "0", 10);
      const numB = parseInt(b.name.match(/\d+/)?.[0] || "0", 10);
      return numA - numB;
    });
  }, [params?.dateKey, groupedMatches]);

  // 날짜가 바뀌면 URL 파라미터 확인 후 탭 설정
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const matchIndexParam = searchParams.get("matchIndex");

    if (matchIndexParam !== null) {
      const index = parseInt(matchIndexParam, 10);
      if (!isNaN(index) && index >= 0) {
        setSelectedMatchIndex(index);
      } else {
        setSelectedMatchIndex(0);
      }
    } else {
      setSelectedMatchIndex(0);
    }

    setIsTransitioning(false);
  }, [params?.dateKey]);

  const selectedMatch = currentDateMatches[selectedMatchIndex];
  const { data: apiHealth } = useApiSportsHealth();
  const { data: scoreboardPayload } = useLiveScoreboard(selectedMatch?.id ?? null, {
    alwaysPoll: true,
  });
  const { data: bettingDistribution } = useQuery({
    queryKey: ["/api/live-match/matches", selectedMatch?.id, "betting-distribution"],
    enabled: Boolean(selectedMatch?.id),
    refetchInterval: 3000,
    queryFn: async () => {
      const res = await fetch(`/api/live-match/matches/${selectedMatch!.id}/betting-distribution`);
      if (!res.ok) throw new Error("배팅 현황 조회 실패");
      return res.json();
    },
  });
  const { data: sideBetSummary } = useQuery({
    queryKey: ["/api/live-match/matches", selectedMatch?.id, "side-bets/summary"],
    enabled: Boolean(selectedMatch?.id),
    refetchInterval: 5000,
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/live-match/matches/${selectedMatch!.id}/side-bets/summary`,
      );
      return res.json();
    },
  });
  const [controlMode, setControlMode] = useState<"auto" | "manual">("auto");
  const [isSyncingApi, setIsSyncingApi] = useState(false);

  useEffect(() => {
    const mode = (selectedMatch as Match & { controlMode?: string })?.controlMode;
    if (mode === "manual" || mode === "auto") {
      setControlMode(mode);
    } else {
      setControlMode(scoreboardPayload?.controlMode === "manual" ? "manual" : "auto");
    }
  }, [selectedMatch?.id, scoreboardPayload?.controlMode, selectedMatch]);

  const handleToggleControlMode = async () => {
    if (!selectedMatch) return;
    const nextMode = controlMode === "auto" ? "manual" : "auto";
    try {
      await apiRequest("POST", `/api/admin/matches/${selectedMatch.id}/control-mode`, {
        mode: nextMode,
      });
      setControlMode(nextMode);
      toast({
        description:
          nextMode === "manual"
            ? "비상 수동 제어 모드로 전환했습니다."
            : "자동 API 동기화 모드로 복귀했습니다.",
      });
    } catch {
      toast({ variant: "destructive", description: "제어 모드 변경에 실패했습니다." });
    }
  };

  const handleSyncFromApiSports = async () => {
    setIsSyncingApi(true);
    try {
      const result = await apiRequest("POST", "/api/admin/matches/sync-from-api-sports", {
        date: params?.dateKey,
      });
      const body = await result.json();
      toast({
        description: `API 일정: 신규 ${body.created ?? 0} · 갱신 ${body.updated ?? 0} · 연결 ${body.linked ?? 0}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stadiums"] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        variant: "destructive",
        description:
          message.includes("API_SPORTS_KEY")
            ? "Replit Secrets에 API_SPORTS_KEY가 없습니다. 추가 후 Redeploy 하세요."
            : `API-SPORTS 동기화 실패: ${message}`,
      });
    } finally {
      setIsSyncingApi(false);
    }
  };

  const clearHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current);
      pongTimeoutRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback((ws: WebSocket, matchId: string) => {
    clearHeartbeat();
    
    heartbeatIntervalRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
        console.log("[Admin WS] Heartbeat ping 전송");
        
        pongTimeoutRef.current = setTimeout(() => {
          console.log("[Admin WS] Pong timeout, 재연결 시도...");
          ws.close();
        }, PONG_TIMEOUT);
      }
    }, HEARTBEAT_INTERVAL);
  }, [clearHeartbeat]);

  // WebSocket 연결 생성 함수
  const createWSConnection = useCallback(async (matchId: string) => {
    // 이미 같은 경기에 연결 중이거나 연결된 상태면 스킵
    if (isConnectingRef.current && currentMatchIdRef.current === matchId) {
      console.log(`[Admin WS] 이미 연결 중 (경기: ${matchId}), 스킵`);
      return;
    }
    
    // 이미 연결된 WebSocket이 같은 경기를 바라보고 있으면 스킵
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && currentMatchIdRef.current === matchId) {
      console.log(`[Admin WS] 이미 연결됨 (경기: ${matchId}), 스킵`);
      return;
    }
    
    console.log(`[Admin WS] 연결 생성 (경기: ${matchId})`);
    isConnectingRef.current = true;
    currentMatchIdRef.current = matchId;

    // 기존 연결 정리 (의도적 종료이므로 언마운트 플래그 설정)
    if (wsRef.current) {
      isUnmountingRef.current = true;
      wsRef.current.close();
      wsRef.current = null;
    }

    clearHeartbeat();

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // WebSocket 연결용 토큰 획득
    let token = "";
    try {
      const tokenResponse = await apiRequest("GET", "/api/admin/ws-token");
      if (!tokenResponse.ok) {
        console.error("[Admin WS] 토큰 획득 실패 - 응답 코드:", tokenResponse.status);
        toast({
          title: "연결 오류",
          description: "인증 토큰을 가져올 수 없습니다. 다시 로그인해주세요.",
          variant: "destructive",
        });
        isConnectingRef.current = false;
        return; // 연결 시도 중단
      }
      const tokenData = await tokenResponse.json();
      if (!tokenData.success || !tokenData.token) {
        console.error("[Admin WS] 토큰 데이터 없음:", tokenData);
        toast({
          title: "연결 오류",
          description: "인증 토큰이 유효하지 않습니다. 다시 로그인해주세요.",
          variant: "destructive",
        });
        isConnectingRef.current = false;
        return; // 연결 시도 중단
      }
      token = tokenData.token;
    } catch (error) {
      console.error("[Admin WS] 토큰 획득 실패:", error);
      toast({
        title: "연결 오류",
        description: "서버 연결에 실패했습니다. 페이지를 새로고침해주세요.",
        variant: "destructive",
      });
      isConnectingRef.current = false;
      return; // 연결 시도 중단
    }

    // WebSocket URL 생성 (토큰 URL 인코딩)
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/match?matchId=${matchId}&token=${encodeURIComponent(token)}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[Admin WS] 연결 성공 (경기: ${matchId})`);
      reconnectAttempts.current = 0;
      isUnmountingRef.current = false;
      isConnectingRef.current = false;
      startHeartbeat(ws, matchId);
    };

    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        const { type, data } = message;
        
        console.log(`[Admin WS] 메시지 수신: ${type}`, data);

        switch (type) {
          case "connected":
            console.log("[Admin WS] 연결 확인:", data);
            break;
          case "round_start":
          case "round_stop":
          case "stats_update":
            if (data.overallStats) {
              setOverallStats(data.overallStats);
            }
            break;
          case "round_result":
            if (data.overallStats) {
              setOverallStats(data.overallStats);
            }
            try {
              const response = await apiRequest(
                "GET",
                `/api/live-match/control/${matchId}/round-details`
              );
              const detailsData = await response.json();
              if (detailsData.roundDetails) {
                setRoundDetails(detailsData.roundDetails);
              }
            } catch (error) {
              console.error("Error fetching round details after result:", error);
            }
            break;
          case "ad_started":
            console.log("광고 시작 이벤트 수신");
            setIsAdPlaying(true);
            setAdElapsedTime(0);
            break;
          case "ad_stopped":
            console.log("광고 중지 이벤트 수신");
            setIsAdPlaying(false);
            setAdElapsedTime(0);
            break;
          case "ad_status":
            if (data.isAdPlaying !== undefined) {
              setIsAdPlaying(data.isAdPlaying);
            }
            break;
          case "pong":
          case "heartbeat_ack":
            if (pongTimeoutRef.current) {
              clearTimeout(pongTimeoutRef.current);
              pongTimeoutRef.current = null;
            }
            break;
          default:
            console.log(`[Admin WS] 알 수 없는 메시지 유형: ${type}`);
        }
      } catch (error) {
        console.error("[Admin WS] 메시지 파싱 오류:", error);
      }
    };

    ws.onclose = (event) => {
      console.log(`[Admin WS] 연결 종료 (경기: ${matchId}), 코드: ${event.code}`);

      if (wsRef.current && wsRef.current !== ws) {
        console.log("[Admin WS] 이전 연결 종료 이벤트 무시 (새 연결로 교체됨)");
        return;
      }

      clearHeartbeat();
      wsRef.current = null;

      // 세션 없음 (4006) - 세션 만료
      if (event.code === 4006) {
        console.log("[Admin WS] 세션 없음, 로그인 페이지로 이동");
        window.dispatchEvent(new CustomEvent("admin-session-expired"));
        return;
      }

      if (event.code === 4010) {
        console.log("[Admin WS] 기존 연결이 새 연결로 교체됨 (정상)");
        return;
      }

      // 정상 종료가 아니고 재연결 시도 횟수가 남아있으면 재연결
      if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current += 1;
        console.log(
          `[Admin WS] 재연결 시도 ${reconnectAttempts.current}/${maxReconnectAttempts}`,
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          createWSConnection(matchId);
        }, RECONNECT_DELAY);
      } else if (reconnectAttempts.current >= maxReconnectAttempts) {
        console.error(`[Admin WS] 최대 재연결 시도 횟수 초과`);
        toast({
          title: "연결 오류",
          description: "서버 연결에 실패했습니다. 페이지를 새로고침해주세요.",
          variant: "destructive",
        });
      }
    };

    ws.onerror = (error) => {
      console.error(`[Admin WS] 연결 오류 (경기: ${matchId}):`, error);
      isConnectingRef.current = false;
    };
  }, [toast, clearHeartbeat, startHeartbeat]);

  useEffect(() => {
    // 이전 WebSocket 연결 정리 (의도적 종료이므로 언마운트 플래그 설정)
    if (wsRef.current) {
      console.log("[Admin WS] 이전 연결 종료");
      isUnmountingRef.current = true;
      wsRef.current.close();
      wsRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // 연결 상태 초기화
    isConnectingRef.current = false;

    // selectedMatch가 없으면 데이터 초기화만
    if (!selectedMatch?.id) {
      setOverallStats(null);
      setRoundDetails([]);
      setIsAdPlaying(false);
      setAdElapsedTime(0);
      setLocalMatchStatus(null);
      return;
    }

    // 경기 전환 시 상태 초기화
    setIsAdPlaying(false);
    setAdElapsedTime(0);
    setLocalMatchStatus(null);

    // 경기 전환 애니메이션 시작
    setIsTransitioning(true);

    const fetchInitialData = async () => {
      try {
        const [statsResponse, roundDetailsResponse] = await Promise.all([
          apiRequest("GET", `/api/live-match/control/${selectedMatch.id}/stats`),
          apiRequest("GET", `/api/live-match/control/${selectedMatch.id}/round-details`),
        ]);

        const statsData = await statsResponse.json();
        if (statsData.overallStats) {
          setOverallStats(statsData.overallStats);
        }

        const roundDetailsData = await roundDetailsResponse.json();
        if (roundDetailsData.roundDetails) {
          setRoundDetails(roundDetailsData.roundDetails);
        }

        // 데이터 로딩 후 애니메이션 종료
        setTimeout(() => setIsTransitioning(false), 100);
      } catch (error) {
        console.error("Error fetching initial data:", error);
        setIsTransitioning(false);
      }
    };

    fetchInitialData();
    reconnectAttempts.current = 0;
    createWSConnection(selectedMatch.id);

    return () => {
      // 언마운트 상태 표시
      isUnmountingRef.current = true;
      isConnectingRef.current = false;
      
      clearHeartbeat();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [selectedMatch?.id, createWSConnection, clearHeartbeat]);


  function formatTime(dateString: string) {
    const date = new Date(dateString);
    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const hours = String(kst.getUTCHours()).padStart(2, "0");
    const minutes = String(kst.getUTCMinutes()).padStart(2, "0");
    const seconds = String(kst.getUTCSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  const handleEndMatchClick = () => {
    if (!overallStats || !roundDetails) {
      setShowConfirmPopup(true);
      return;
    }

    const predictionActive = overallStats.predictionEnabled;
    const roundsWithoutResult = roundDetails
      .filter((rd) => rd.result === null && rd.totalParticipants > 0)
      .map((rd) => rd.roundNumber);

    if (predictionActive || roundsWithoutResult.length > 0) {
      setIncompleteRoundsInfo({ predictionActive, roundsWithoutResult });
      setShowIncompleteRoundsWarning(true);
    } else {
      setShowConfirmPopup(true);
    }
  };

  const handleConfirmEndMatchWithWarning = () => {
    setShowIncompleteRoundsWarning(false);
    setShowConfirmPopup(true);
  };

  const handleConfirmEndMatch = async () => {
    if (!selectedMatch) return;

    setShowConfirmPopup(false);

    try {
      const response = await apiRequest(
        "POST",
        `/api/live-match/control/${selectedMatch.id}/end`,
      );

      if (response.ok) {
        setLocalMatchStatus("completed");
        queryClient.invalidateQueries({ queryKey: ["/api/admin/matches"] });
        toast({
          title: "경기 종료",
          description: "경기가 종료되었습니다.",
        });
      }
    } catch (error) {
      console.error("Error ending match:", error);
      toast({
        title: "오류",
        description: "경기 종료에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleAdToggle = async () => {
    if (!selectedMatch || isAdLoading) return;

    setIsAdLoading(true);
    try {
      const endpoint = isAdPlaying
        ? `/api/admin/matches/${selectedMatch.id}/ad/stop`
        : `/api/admin/matches/${selectedMatch.id}/ad/start`;

      const response = await apiRequest("POST", endpoint);

      if (response.ok) {
        if (isAdPlaying) {
          setIsAdPlaying(false);
          setAdElapsedTime(0);
        } else {
          setIsAdPlaying(true);
          setAdElapsedTime(0);
        }
      }
    } catch (error) {
      console.error("Error toggling ad:", error);
      toast({
        title: "오류",
        description: "광고 재생에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsAdLoading(false);
    }
  };

  const formatAdTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // 광고 타이머 효과
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isAdPlaying) {
      interval = setInterval(() => {
        setAdElapsedTime((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isAdPlaying]);

  const getPredictionStatus = (
    roundNumber: number,
    hasStats: boolean,
  ): string => {
    const currentRound =
      overallStats?.currentRound || selectedMatch?.currentRound || 1;
    const predictionEnabled = overallStats?.predictionEnabled ?? true;

    if (hasStats) {
      return "예측 결과";
    }

    if (roundNumber === currentRound) {
      return predictionEnabled ? "예측 중" : "예측 종료";
    }

    if (roundNumber > currentRound) {
      return "예측 시작 전";
    }

    return "예측 결과";
  };

  const getRoundsToDisplay = () => {
    const currentRound =
      overallStats?.currentRound || selectedMatch?.currentRound || 1;
    const rounds: Array<{
      roundNumber: number;
      game: string;
      predictStatus: string;
      predictCount: number | null;
      totalPoint: number | null;
      result: string;
      winners: number | null;
      distributedPoint: number | null;
    }> = [];

    const maxRound = Math.max(
      currentRound,
      ...roundDetails.map((r) => r.roundNumber),
      0,
    );

    for (let i = 1; i <= maxRound + 1; i++) {
      const roundDetail = roundDetails.find((r) => r.roundNumber === i);
      const hasStats = !!roundDetail;

      rounds.push({
        roundNumber: i,
        game: `${i}회`,
        predictStatus: getPredictionStatus(i, hasStats),
        predictCount:
          roundDetail?.totalParticipants ??
          (i === currentRound
            ? (overallStats?.currentRoundParticipants ?? null)
            : null),
        totalPoint:
          roundDetail?.totalPoints ??
          (i === currentRound
            ? (overallStats?.currentRoundPoints ?? null)
            : null),
        result: roundDetail?.result || "--",
        winners: roundDetail?.totalWinners ?? null,
        distributedPoint: roundDetail?.distributedPoints ?? null,
      });
    }

    return rounds.reverse();
  };

  const matchStatus = localMatchStatus || selectedMatch?.matchStatus;
  const isMatchCompleted = matchStatus === "completed";
  const roundsToDisplay = getRoundsToDisplay();
  const bettingItems = (bettingDistribution?.distribution ?? []) as Array<{
    prediction: string;
    odds: number;
    count: number;
    totalPoints: number;
  }>;
  const maxBetPoints = Math.max(...bettingItems.map((d) => d.totalPoints || 0), 1);

  const handleSelectMatchTab = (index: number) => {
    if (selectedMatchIndex === index) return;
    setIsTransitioning(true);
    setSelectedMatchIndex(index);
    const url = new URL(window.location.href);
    url.searchParams.set("matchIndex", String(index));
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <AdminLayout>
      <div className="flex items-center gap-2 mb-4" data-testid="breadcrumb">
        <Link
          href="/admin/match-management?tab=matches"
          className="text-sm text-[#BFBFBF] hover:text-[#E11936] transition-colors"
          data-testid="link-match-management"
        >
          경기 관리
        </Link>
        <span className="text-sm text-[#BFBFBF]">&gt;</span>
        <span className="text-sm text-[#201E22]">실시간 게임 모니터링</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1
          className="text-xl font-semibold text-[#201E22] flex items-center gap-2"
          data-testid="text-page-title"
        >
          <img src={assets.adListIcon} className="w-7 h-7" alt="" />
          실시간 게임 모니터링
        </h1>
        {params?.dateKey && (
          <span className="text-sm text-[#666] bg-[#F5F5F5] px-3 py-1 rounded-full">
            {formatDateKey(params.dateKey)} (KST)
          </span>
        )}
      </div>

      {currentDateMatches.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {currentDateMatches.map((match, index) => (
            <button
              key={match.id}
              type="button"
              onClick={() => handleSelectMatchTab(index)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                selectedMatchIndex === index
                  ? "border-[#E11936] bg-[#FFF5F5] text-[#E11936]"
                  : "border-[#E9E9E9] bg-white text-[#888] hover:border-[#E11936]/40"
              }`}
              data-testid={`tab-match-${index + 1}`}
            >
              {match.name}
            </button>
          ))}
        </div>
      )}

      {selectedMatch && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MonitoringStatCard
              label="총 예측자"
              value={overallStats?.totalPredictors ?? 0}
              transitioning={isTransitioning}
            />
            <MonitoringStatCard
              label="총 참여기록"
              value={overallStats?.totalPredictionPoints ?? 0}
              accent
              transitioning={isTransitioning}
            />
            <MonitoringStatCard
              label="현재 라운드"
              value={overallStats?.currentRound || selectedMatch.currentRound || 0}
              transitioning={isTransitioning}
            />
            <MonitoringStatCard
              label="총 승리자"
              value={overallStats?.totalWinners ?? 0}
              transitioning={isTransitioning}
            />
            <MonitoringStatCard
              label="분배 참여기록"
              value={overallStats?.totalDistributedPoints ?? 0}
              accent
              transitioning={isTransitioning}
            />
            <MonitoringStatCard
              label="경기 시간"
              value={
                isMatchCompleted
                  ? `${formatTime(selectedMatch.startTime)}~${formatTime(selectedMatch.endTime)}`
                  : `${formatTime(selectedMatch.startTime)}~진행중`
              }
              transitioning={isTransitioning}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 space-y-5">
              <MonitoringSection title="실시간 스코어보드">
                <LiveScoreboard scoreboard={scoreboardPayload?.scoreboard ?? null} compact />
              </MonitoringSection>

              <MonitoringSection title="라운드별 예측 현황">
                <div className="overflow-x-auto -mx-4 px-4">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-[#888] border-b border-[#EEE]">
                        <th className="pb-2 pr-3 font-medium">회차</th>
                        <th className="pb-2 pr-3 font-medium">상태</th>
                        <th className="pb-2 pr-3 font-medium text-right">예측</th>
                        <th className="pb-2 pr-3 font-medium text-right">참여기록</th>
                        <th className="pb-2 pr-3 font-medium">결과</th>
                        <th className="pb-2 pr-3 font-medium text-right">승리</th>
                        <th className="pb-2 font-medium text-right">분배</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F0F0]">
                      {roundsToDisplay.map((round, index) => (
                        <tr
                          key={round.roundNumber}
                          className="text-[#201E22]"
                          data-testid={`game-row-${index}`}
                        >
                          <td className="py-2.5 pr-3 font-medium">{round.game}</td>
                          <td className="py-2.5 pr-3 text-[#666]">{round.predictStatus}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            {round.predictCount ?? "--"}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            {round.totalPoint != null ? round.totalPoint.toLocaleString() : "--"}
                          </td>
                          <td className="py-2.5 pr-3">{round.result}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            {round.winners ?? "--"}
                          </td>
                          <td className="py-2.5 text-right tabular-nums">
                            {round.distributedPoint != null
                              ? round.distributedPoint.toLocaleString()
                              : "--"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </MonitoringSection>
            </div>

            <div className="space-y-5">
              <MonitoringSection
                title="운영 제어"
                action={
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                      apiHealth?.healthy ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        apiHealth?.healthy ? "bg-green-500" : "bg-red-500"
                      }`}
                    />
                    API {apiHealth?.healthy ? "정상" : "오류"}
                  </span>
                }
              >
                <div className="space-y-3">
                  <p className="text-xs text-[#888] leading-relaxed">
                    {controlMode === "manual" ? "수동 제어" : "자동 동기화"} · 지연{" "}
                    {apiHealth?.latencyMs ?? "-"}ms
                    {apiHealth?.lastError && (
                      <span className="block text-red-600 mt-1">{apiHealth.lastError}</span>
                    )}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleSyncFromApiSports}
                      disabled={isSyncingApi}
                      className="px-3 py-2 text-xs rounded-lg border border-[#E9E9E9] hover:border-[#E11936] hover:text-[#E11936] disabled:opacity-50"
                    >
                      {isSyncingApi ? "동기화 중..." : "API 경기 등록"}
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleControlMode}
                      className={`px-3 py-2 text-xs rounded-lg border ${
                        controlMode === "manual"
                          ? "border-red-400 text-red-600 bg-red-50"
                          : "border-[#E9E9E9] hover:border-[#E11936] hover:text-[#E11936]"
                      }`}
                    >
                      {controlMode === "manual" ? "수동 제어" : "수동 전환"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleAdToggle}
                      disabled={isMatchCompleted || isAdLoading}
                      className={`py-3 rounded-lg text-sm font-semibold text-white transition ${
                        isMatchCompleted || isAdLoading
                          ? "bg-[#AAA] cursor-not-allowed"
                          : "bg-[#4CAF50] hover:bg-[#45A049]"
                      }`}
                      data-testid="button-ad-toggle"
                    >
                      {isAdPlaying ? `광고 ${formatAdTime(adElapsedTime)}` : "광고 재생"}
                    </button>
                    <button
                      type="button"
                      onClick={handleEndMatchClick}
                      disabled={isMatchCompleted}
                      className={`py-3 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1 transition ${
                        isMatchCompleted
                          ? "bg-[#AAA] cursor-not-allowed"
                          : "bg-[#E11936] hover:bg-[#C71530]"
                      }`}
                      data-testid="button-end-match"
                    >
                      <img src={assets.adFlagIcon} className="w-4 h-4" alt="" />
                      {isMatchCompleted ? "종료됨" : "경기 종료"}
                    </button>
                  </div>
                </div>
              </MonitoringSection>

              <MonitoringSection title="현재 라운드 배팅">
                {bettingItems.length === 0 ? (
                  <p className="text-xs text-[#888]">배팅 데이터 없음</p>
                ) : (
                  <div className="space-y-3">
                    {bettingItems.map((item) => (
                      <div key={item.prediction}>
                        <div className="flex justify-between text-xs text-[#666] mb-1">
                          <span>
                            {item.prediction} ({item.odds}배)
                          </span>
                          <span>
                            {item.count}명 · {item.totalPoints}P
                          </span>
                        </div>
                        <div className="h-1.5 bg-[#F0F0F0] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#E11936] rounded-full"
                            style={{
                              width: `${Math.round(((item.totalPoints || 0) / maxBetPoints) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </MonitoringSection>

              <MonitoringSection
                title="승리팀 · 스코어 배팅"
                action={
                  sideBetSummary?.sideBetsLocked ? (
                    <span className="text-xs text-amber-600 font-medium">마감</span>
                  ) : (
                    <span className="text-xs text-green-600 font-medium">접수중</span>
                  )
                }
              >
                <div className="grid grid-cols-1 gap-3 text-xs">
                  <div className="rounded-lg bg-[#F9F9F9] p-3">
                    <p className="font-semibold text-[#201E22] mb-1">승리팀 (2배)</p>
                    <p className="text-[#666]">
                      {sideBetSummary?.summary?.winner?.count ?? 0}명 ·{" "}
                      {sideBetSummary?.summary?.winner?.totalPoints ?? 0}P
                    </p>
                    <p className="text-[#888] mt-1">
                      홈 {sideBetSummary?.summary?.winner?.home ?? 0} / 원정{" "}
                      {sideBetSummary?.summary?.winner?.away ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#F9F9F9] p-3">
                    <p className="font-semibold text-[#201E22] mb-1">최종 스코어 (20배)</p>
                    <p className="text-[#666]">
                      {sideBetSummary?.summary?.score?.count ?? 0}명 ·{" "}
                      {sideBetSummary?.summary?.score?.totalPoints ?? 0}P
                    </p>
                  </div>
                  <p className="text-[11px] text-[#888]">
                    대기 {sideBetSummary?.summary?.pending ?? 0} · 적중{" "}
                    {sideBetSummary?.summary?.won ?? 0} · 미적중{" "}
                    {sideBetSummary?.summary?.lost ?? 0} · 환불{" "}
                    {sideBetSummary?.summary?.refunded ?? 0}
                  </p>
                </div>
              </MonitoringSection>
            </div>
          </div>
        </div>
      )}

      {!selectedMatch && (
        <div className="flex items-center justify-center h-[400px]">
          <p className="text-base text-[#BFBFBF]">경기 데이터가 없습니다.</p>
        </div>
      )}

      {/* 미완료 라운드 경고 팝업 */}
      {showIncompleteRoundsWarning && selectedMatch && incompleteRoundsInfo && (
        <AdminConfirmPopup
          title="미완료 라운드가 있습니다"
          message={
            incompleteRoundsInfo.predictionActive
              ? `현재 예측이 진행 중입니다.${incompleteRoundsInfo.roundsWithoutResult.length > 0 ? ` 또한 ${incompleteRoundsInfo.roundsWithoutResult.join(", ")}라운드의 결과가 전송되지 않았습니다.` : ""}`
              : `${incompleteRoundsInfo.roundsWithoutResult.join(", ")}라운드의 결과가 전송되지 않았습니다.`
          }
          footerText="그래도 경기를 종료하시겠습니까?"
          cancelText="취소"
          confirmText="종료"
          confirmVariant="danger"
          onCancel={() => {
            setShowIncompleteRoundsWarning(false);
            setIncompleteRoundsInfo(null);
          }}
          onConfirm={handleConfirmEndMatchWithWarning}
        />
      )}

      {/* 경기 종료 확인 팝업 */}
      {showConfirmPopup && selectedMatch && (
        <AdminConfirmPopup
          title={`${selectedMatch.name} 경기를 종료하시겠어요?`}
          details={[
            { label: "경기명", value: selectedMatch.name },
            { label: "시작 시간", value: formatTime(selectedMatch.startTime) },
            { label: "종료 시간", value: "경기 종료 시 기록됩니다" },
          ]}
          footerText="경기를 종료하면 더 이상 예측을 받을 수 없습니다."
          cancelText="취소"
          confirmText="종료"
          confirmVariant="danger"
          onCancel={() => setShowConfirmPopup(false)}
          onConfirm={handleConfirmEndMatch}
        />
      )}
    </AdminLayout>
  );
}
