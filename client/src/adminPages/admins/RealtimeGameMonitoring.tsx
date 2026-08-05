import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import AdminLayout from "../adminLayout";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import AdminConfirmPopup from "@/components/customUi/AdminConfirmPopup";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/adminQueryClient";
import LiveScoreboard from "@/components/LiveScoreboard";
import { useApiSportsHealth, useLiveScoreboard } from "@/hooks/useLiveScoreboard";
import { Button } from "@/components/ui/button";
import { OpsPlatformTabs, type OpsPlatform } from "../ops/opsLoginStatusUi";
import { countMatchesByPlatform, resolveMatchPlatform } from "@/lib/matchPlatform";
import { cn } from "@/lib/utils";

interface Match {
  id: string;
  name: string;
  stadiumId: number;
  startTime: string;
  endTime: string;
  matchStatus: string;
  currentRound: number;
  controlMode?: string;
  matchDate?: string | null;
  apiSportsGameId?: number | null;
  registrationOrder?: number | null;
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
  const [platform, setPlatform] = useState<OpsPlatform>("ppamong");
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

  // 현재 날짜의 전체 경기 (name 숫자 정렬)
  const allDateMatches = useMemo(() => {
    const matches = params?.dateKey ? groupedMatches[params.dateKey] || [] : [];
    return matches.sort((a, b) => {
      const numA = parseInt(a.name.match(/\d+/)?.[0] || "0", 10);
      const numB = parseInt(b.name.match(/\d+/)?.[0] || "0", 10);
      return numA - numB;
    });
  }, [params?.dateKey, groupedMatches]);

  const platformCounts = useMemo(
    () => countMatchesByPlatform(allDateMatches),
    [allDateMatches],
  );

  const currentDateMatches = useMemo(
    () => allDateMatches.filter((m) => resolveMatchPlatform(m) === platform),
    [allDateMatches, platform],
  );

  useEffect(() => {
    setSelectedMatchIndex(0);
    const url = new URL(window.location.href);
    url.searchParams.set("matchIndex", "0");
    window.history.replaceState({}, "", url.toString());
  }, [platform]);

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

  useEffect(() => {
    if (currentDateMatches.length === 0) return;
    if (selectedMatchIndex >= currentDateMatches.length) {
      setSelectedMatchIndex(0);
    }
  }, [currentDateMatches.length, selectedMatchIndex]);

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

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/matches"] });
    if (selectedMatch?.id) {
      queryClient.invalidateQueries({
        queryKey: ["/api/live-match/matches", selectedMatch.id],
      });
    }
  };

  const matchTimeLabel = selectedMatch
    ? isMatchCompleted
      ? `${formatTime(selectedMatch.startTime)}~${formatTime(selectedMatch.endTime)}`
      : `${formatTime(selectedMatch.startTime)}~진행중`
    : "";

  return (
    <AdminLayout>
      <div className="flex flex-col h-full min-h-0 -mx-3 sm:-mx-4 md:-mx-5 lg:-mx-6 xl:-mx-8">
        <div
          className="flex flex-wrap items-center justify-between gap-2 mb-3 px-3 sm:px-4 md:px-5 lg:px-6 xl:px-8"
          data-testid="text-page-title"
        >
          <Link
            href="/admin/match-management?tab=matches"
            className="text-xs text-[#888] hover:text-[#E11936]"
            data-testid="link-match-management"
          >
            ← 경기 관리
          </Link>
          <div className="flex items-center gap-2">
            {params?.dateKey && (
              <span className="text-xs text-[#666] tabular-nums">{formatDateKey(params.dateKey)}</span>
            )}
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleRefresh}>
              새로고침
            </Button>
          </div>
        </div>

        <div className="px-3 sm:px-4 md:px-5 lg:px-6 xl:px-8 mb-3">
          <OpsPlatformTabs
            platform={platform}
            counts={platformCounts}
            onChange={setPlatform}
            ppamongSublabel="KBO · API 연동 경기"
            badminton9Sublabel="PG 레거시 경기"
            countLabel="경기"
          />
        </div>

        {currentDateMatches.length > 0 && (
          <div className="overflow-x-auto mb-3 px-3 sm:px-4 md:px-5 lg:px-6 xl:px-8">
            <div className="flex gap-1.5 min-w-max pb-1">
              {currentDateMatches.map((match, index) => (
                <button
                  key={match.id}
                  type="button"
                  onClick={() => handleSelectMatchTab(index)}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-medium border whitespace-nowrap transition-colors",
                    selectedMatchIndex === index
                      ? "border-[#E11936] bg-[#FFF5F6] text-[#E11936]"
                      : "border-[#E9E9E9] bg-white text-[#888] hover:border-[#E11936]/30",
                  )}
                  data-testid={`tab-match-${index + 1}`}
                >
                  {match.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedMatch && (
          <div className="flex flex-col flex-1 min-h-0 space-y-2">
            <div className="px-3 sm:px-4 md:px-5 lg:px-6 xl:px-8">
              <LiveScoreboard scoreboard={scoreboardPayload?.scoreboard ?? null} dense />
            </div>

            <div
              className={cn(
                "mx-3 sm:mx-4 md:mx-5 lg:mx-6 xl:mx-8 px-3 py-2 rounded-md bg-[#F3F0FF] border border-[#EDE9F6] text-xs sm:text-sm text-[#201E22] tabular-nums transition-opacity duration-300",
                isTransitioning ? "opacity-50" : "opacity-100",
              )}
            >
              <span className="text-[#666]">예측 </span>
              <span className="font-semibold">{overallStats?.totalPredictors ?? 0}</span>
              <span className="text-[#CCC] mx-1.5">·</span>
              <span className="text-[#666]">참여 </span>
              <span className="font-semibold text-[#E11936]">
                {(overallStats?.totalPredictionPoints ?? 0).toLocaleString()}
              </span>
              <span className="text-[#CCC] mx-1.5">·</span>
              <span className="text-[#666]">R</span>
              <span className="font-semibold ml-0.5">
                {overallStats?.currentRound || selectedMatch.currentRound || 0}
              </span>
              <span className="text-[#CCC] mx-1.5">·</span>
              <span className="text-[#666]">승리 </span>
              <span className="font-semibold">{overallStats?.totalWinners ?? 0}</span>
              <span className="text-[#CCC] mx-1.5">·</span>
              <span className="text-[#666]">분배 </span>
              <span className="font-semibold text-[#E11936]">
                {(overallStats?.totalDistributedPoints ?? 0).toLocaleString()}
              </span>
              <span className="text-[#CCC] mx-1.5">·</span>
              <span className="text-[#888]">{matchTimeLabel}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-2 flex-1 min-h-0 px-3 sm:px-4 md:px-5 lg:px-6 xl:px-8 pb-4">
              <div className="lg:col-span-3 flex flex-col min-h-0 rounded-lg border border-[#E8E4F3] overflow-hidden bg-white">
                <div className="px-2.5 py-1.5 bg-[#F3F0FF] border-b border-[#EDE9F6] text-xs font-semibold text-[#6B5B95]">
                  라운드
                </div>
                <div className="overflow-x-auto flex-1 min-h-0">
                  <table className="w-full min-w-[520px] text-xs">
                    <thead>
                      <tr className="text-left text-[#888] border-b border-[#F0F0F0] bg-[#FAFAFA]">
                        <th className="px-2 py-1.5 font-medium">회차</th>
                        <th className="px-2 py-1.5 font-medium">상태</th>
                        <th className="px-2 py-1.5 font-medium text-right">예측</th>
                        <th className="px-2 py-1.5 font-medium text-right">참여</th>
                        <th className="px-2 py-1.5 font-medium">결과</th>
                        <th className="px-2 py-1.5 font-medium text-right">분배</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5F5F5]">
                      {roundsToDisplay.map((round, index) => (
                        <tr key={round.roundNumber} className="text-[#201E22]" data-testid={`game-row-${index}`}>
                          <td className="px-2 py-1.5 font-medium">{round.game}</td>
                          <td className="px-2 py-1.5 text-[#666]">{round.predictStatus}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{round.predictCount ?? "—"}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {round.totalPoint != null ? round.totalPoint.toLocaleString() : "—"}
                          </td>
                          <td className="px-2 py-1.5">{round.result}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {round.distributedPoint != null ? round.distributedPoint.toLocaleString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="lg:col-span-2 flex flex-col gap-2 min-h-0">
                <div className="rounded-lg border border-[#E8E4F3] bg-white p-2.5">
                  <div className="flex flex-wrap items-center gap-1 mb-2">
                    <button
                      type="button"
                      onClick={handleSyncFromApiSports}
                      disabled={isSyncingApi}
                      className="px-2 py-1 text-[11px] rounded border border-[#E9E9E9] hover:border-[#E11936] hover:text-[#E11936] disabled:opacity-50 whitespace-nowrap"
                    >
                      {isSyncingApi ? "동기화…" : "API 등록"}
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleControlMode}
                      className={cn(
                        "px-2 py-1 text-[11px] rounded border whitespace-nowrap",
                        controlMode === "manual"
                          ? "border-red-300 text-red-600 bg-red-50"
                          : "border-[#E9E9E9] hover:border-[#E11936] hover:text-[#E11936]",
                      )}
                    >
                      {controlMode === "manual" ? "수동 ON" : "수동 전환"}
                    </button>
                    <button
                      type="button"
                      onClick={handleAdToggle}
                      disabled={isMatchCompleted || isAdLoading}
                      className={cn(
                        "px-2 py-1 text-[11px] rounded font-medium text-white whitespace-nowrap",
                        isMatchCompleted || isAdLoading
                          ? "bg-[#BDBDBD] cursor-not-allowed"
                          : "bg-[#81C784] hover:bg-[#66BB6A]",
                      )}
                      data-testid="button-ad-toggle"
                    >
                      {isAdPlaying ? `광고 ${formatAdTime(adElapsedTime)}` : "광고"}
                    </button>
                    <button
                      type="button"
                      onClick={handleEndMatchClick}
                      disabled={isMatchCompleted}
                      className={cn(
                        "px-2 py-1 text-[11px] rounded font-medium text-white inline-flex items-center gap-1 whitespace-nowrap",
                        isMatchCompleted
                          ? "bg-[#BDBDBD] cursor-not-allowed"
                          : "bg-[#E57373] hover:bg-[#EF5350]",
                      )}
                      data-testid="button-end-match"
                    >
                      <img src={assets.adFlagIcon} className="w-3 h-3" alt="" />
                      {isMatchCompleted ? "종료됨" : "경기 종료"}
                    </button>
                    <span
                      className={cn(
                        "ml-auto inline-flex items-center gap-1 text-[10px] font-medium whitespace-nowrap",
                        apiHealth?.healthy ? "text-green-600" : "text-red-600",
                      )}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          apiHealth?.healthy ? "bg-green-500" : "bg-red-500",
                        )}
                      />
                      API {apiHealth?.healthy ? "정상" : "오류"} {apiHealth?.latencyMs ?? "-"}ms
                    </span>
                  </div>
                  {apiHealth?.lastError && (
                    <p className="text-[10px] text-red-600 mb-2 truncate" title={apiHealth.lastError}>
                      {apiHealth.lastError}
                    </p>
                  )}

                  {bettingItems.length === 0 ? (
                    <p className="text-[11px] text-[#888]">배팅 데이터 없음</p>
                  ) : (
                    <div className="space-y-1.5 mb-2">
                      {bettingItems.slice(0, 4).map((item) => (
                        <div key={item.prediction} className="flex items-center gap-2 text-[11px]">
                          <span className="text-[#666] shrink-0 w-[72px] truncate" title={item.prediction}>
                            {item.prediction}
                          </span>
                          <div className="flex-1 h-1 bg-[#F0F0F0] rounded-full overflow-hidden min-w-[40px]">
                            <div
                              className="h-full bg-[#E57373] rounded-full"
                              style={{
                                width: `${Math.round(((item.totalPoints || 0) / maxBetPoints) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-[#888] tabular-nums shrink-0">
                            {item.count}명·{item.totalPoints}P
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[11px] text-[#666] leading-relaxed border-t border-[#F0F0F0] pt-2">
                    <span className="font-medium text-[#201E22]">사이드벳</span>
                    {sideBetSummary?.sideBetsLocked ? (
                      <span className="ml-1.5 text-amber-600">마감</span>
                    ) : (
                      <span className="ml-1.5 text-green-600">접수중</span>
                    )}
                    <span className="text-[#CCC] mx-1">|</span>
                    승리팀 {sideBetSummary?.summary?.winner?.count ?? 0}명 ·{" "}
                    {sideBetSummary?.summary?.winner?.totalPoints ?? 0}P
                    <span className="text-[#CCC] mx-1">|</span>
                    스코어 {sideBetSummary?.summary?.score?.count ?? 0}명 ·{" "}
                    {sideBetSummary?.summary?.score?.totalPoints ?? 0}P
                    <span className="block text-[#888] mt-0.5">
                      대기 {sideBetSummary?.summary?.pending ?? 0} · 적중{" "}
                      {sideBetSummary?.summary?.won ?? 0} · 미적중{" "}
                      {sideBetSummary?.summary?.lost ?? 0}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {!selectedMatch && (
          <div className="flex items-center justify-center py-20 px-4">
            <p className="text-sm text-[#BFBFBF]">
              {allDateMatches.length === 0
                ? "이 날짜에 등록된 경기가 없습니다."
                : platform === "ppamong"
                  ? "빠몽(KBO) 경기가 없습니다."
                  : "빠던9 레거시 경기가 없습니다."}
            </p>
          </div>
        )}
      </div>

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
