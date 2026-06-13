import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import AdminLayout from "../adminLayout";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import AdminConfirmPopup from "@/components/customUi/AdminConfirmPopup";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/adminQueryClient";

interface Match {
  id: string;
  name: string;
  stadiumId: number;
  startTime: string;
  endTime: string;
  matchStatus: string;
  currentRound: number;
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

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const year = kst.getUTCFullYear();
    const month = String(kst.getUTCMonth() + 1).padStart(2, "0");
    const day = String(kst.getUTCDate()).padStart(2, "0");
    return `${year}. ${month}. ${day}`;
  }

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

  return (
    <AdminLayout>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6" data-testid="breadcrumb">
        <Link
          href="/admin/match-management?tab=matches"
          className="text-sm text-[#BFBFBF] hover:text-[#E11936] cursor-pointer transition-colors"
          data-testid="link-match-management"
        >
          경기 관리
        </Link>
        <span className="text-sm text-[#BFBFBF]">&gt;</span>
        <span className="text-sm text-[#201E22]">실시간 게임 모니터링</span>
      </div>

      {/* Page Title */}
      <h1
        className="text-2xl font-semibold text-[#201E22] mb-6 flex items-center gap-2"
        data-testid="text-page-title"
      >
        <img src={assets.adListIcon} className="w-8 h-8" alt="icon" /> 실시간
        게임 모니터링
      </h1>

      {/* Match Tabs */}
      <div className="flex gap-4 border-b border-[#E9E9E9] mb-6">
        {currentDateMatches.map((match, index) => (
          <button
            key={match.id}
            onClick={() => {
              if (selectedMatchIndex !== index) {
                setIsTransitioning(true);
                setSelectedMatchIndex(index);
              }
            }}
            className={`pb-3 px-8 text-base font-medium hover:border-b-2 hover:border-[#E11936] hover:text-[#E11936] ${
              selectedMatchIndex === index
                ? "border-b-2 border-[#E11936] text-[#E11936]"
                : "text-[#BFBFBF] border-transparent"
            }`}
            data-testid={`tab-match-${index + 1}`}
          >
            {match.name}
          </button>
        ))}
      </div>

      {selectedMatch && (
        <>
          {/* Match Info Section - 4열 2행 (작은 화면) / 8열 1행 (큰 화면) */}
          <div className="grid grid-cols-4 xl:grid-cols-8 gap-2 xl:gap-3 w-full">
            {/* 1행: 첫 3개 통계 카드 */}
            <div className="flex flex-col justify-between p-2 sm:p-3 xl:p-5 border border-[#E9E9E9] rounded-[10px] h-[80px] sm:h-[100px] xl:h-[120px]">
              <div className="font-pretendard font-semibold text-[12px] sm:text-[14px] xl:text-[18px] text-[#201E22] truncate whitespace-nowrap">
                총 예측자
              </div>
              <div
                className={`text-right font-pretendard font-extrabold transition-all duration-300 whitespace-nowrap text-[18px] sm:text-[22px] xl:text-[26px] ${
                  isTransitioning ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0"
                }`}
                style={{ color: "#201E22" }}
              >
                {overallStats?.totalPredictors || 0}
              </div>
            </div>

            <div className="flex flex-col justify-between p-2 sm:p-3 xl:p-5 border border-[#E9E9E9] rounded-[10px] h-[80px] sm:h-[100px] xl:h-[120px]">
              <div className="font-pretendard font-semibold text-[12px] sm:text-[14px] xl:text-[18px] text-[#201E22] truncate whitespace-nowrap">
                총 참여기록
              </div>
              <div
                className={`text-right font-pretendard font-extrabold transition-all duration-300 whitespace-nowrap text-[18px] sm:text-[22px] xl:text-[26px] ${
                  isTransitioning ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0"
                }`}
                style={{ color: "#E11936" }}
              >
                {overallStats?.totalPredictionPoints || 0}
              </div>
            </div>

            <div className="flex flex-col justify-between p-2 sm:p-3 xl:p-5 border border-[#E9E9E9] rounded-[10px] h-[80px] sm:h-[100px] xl:h-[120px]">
              <div className="font-pretendard font-semibold text-[12px] sm:text-[14px] xl:text-[18px] text-[#201E22] truncate whitespace-nowrap">
                진행중인 경기
              </div>
              <div
                className={`text-right font-pretendard font-extrabold transition-all duration-300 whitespace-nowrap text-[18px] sm:text-[22px] xl:text-[26px] ${
                  isTransitioning ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0"
                }`}
                style={{ color: "#201E22" }}
              >
                {overallStats?.currentRound || selectedMatch?.currentRound || 0}
              </div>
            </div>

            {/* 4열: 총 승리자 */}
            <div className="flex flex-col justify-between p-2 sm:p-3 xl:p-5 border border-[#E9E9E9] rounded-[10px] h-[80px] sm:h-[100px] xl:h-[120px]">
              <div className="font-pretendard font-semibold text-[12px] sm:text-[14px] xl:text-[18px] text-[#201E22] truncate whitespace-nowrap">
                총 승리자
              </div>
              <div
                className={`text-right font-pretendard font-extrabold transition-all duration-300 whitespace-nowrap text-[18px] sm:text-[22px] xl:text-[26px] ${
                  isTransitioning ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0"
                }`}
                style={{ color: "#201E22" }}
              >
                {overallStats?.totalWinners || 0}
              </div>
            </div>

            {/* 5열: 분배된 포인트 */}
            <div className="flex flex-col justify-between p-2 sm:p-3 xl:p-5 border border-[#E9E9E9] rounded-[10px] h-[80px] sm:h-[100px] xl:h-[120px]">
              <div className="font-pretendard font-semibold text-[12px] sm:text-[14px] xl:text-[18px] text-[#201E22] truncate whitespace-nowrap">
                분배된 참여기록
              </div>
              <div
                className={`text-right font-pretendard font-extrabold transition-all duration-300 whitespace-nowrap text-[18px] sm:text-[22px] xl:text-[26px] ${
                  isTransitioning ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0"
                }`}
                style={{ color: "#E11936" }}
              >
                {overallStats?.totalDistributedPoints || 0}
              </div>
            </div>

            {/* 6열: 경기시간 */}
            <div className="flex flex-col justify-between p-2 sm:p-3 xl:p-5 border border-[#E9E9E9] rounded-[10px] h-[80px] sm:h-[100px] xl:h-[120px]">
              <div className="font-pretendard font-semibold text-[12px] sm:text-[14px] xl:text-[18px] text-[#201E22] truncate whitespace-nowrap">
                경기시간
              </div>
              <div
                className={`text-right font-pretendard font-extrabold transition-all duration-300 whitespace-nowrap text-[12px] sm:text-[14px] xl:text-[15px] ${
                  isTransitioning ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0"
                }`}
                style={{ color: "#201E22" }}
              >
                {selectedMatch ? `${formatTime(selectedMatch.startTime)} - ${selectedMatch.matchStatus === 'completed' ? formatTime(selectedMatch.endTime) : '진행 중'}` : "--"}
              </div>
            </div>

            {/* 7열: 광고 재생 버튼 */}
            <button
              onClick={handleAdToggle}
              disabled={(localMatchStatus || selectedMatch?.matchStatus) === "completed" || isAdLoading}
              className={`flex flex-col justify-center items-center h-[80px] sm:h-[100px] xl:h-[120px] rounded-[10px] transition xl:row-span-1 ${
                (localMatchStatus || selectedMatch?.matchStatus) === "completed" || isAdLoading
                  ? "bg-[#6B6B6B] cursor-not-allowed opacity-50"
                  : "bg-[#4CAF50] hover:bg-[#45A049]"
              }`}
              data-testid="button-ad-toggle"
            >
              <div className="font-pretendard font-extrabold text-[14px] sm:text-[16px] xl:text-[20px] text-white text-center whitespace-nowrap">
                {isAdPlaying ? "광고 재생중" : "광고 재생"}
              </div>
              {isAdPlaying && (
                <div className="font-pretendard font-semibold text-[14px] sm:text-[16px] xl:text-[20px] text-white mt-1 xl:mt-2 whitespace-nowrap">
                  {formatAdTime(adElapsedTime)}
                </div>
              )}
            </button>

            {/* 8열: 경기 종료 버튼 */}
            <button
              onClick={handleEndMatchClick}
              disabled={(localMatchStatus || selectedMatch?.matchStatus) === "completed"}
              className={`flex justify-center items-center h-[80px] sm:h-[100px] xl:h-[120px] rounded-[10px] gap-1 xl:gap-2 transition ${
                (localMatchStatus || selectedMatch?.matchStatus) === "completed"
                  ? "bg-[#6B6B6B] cursor-not-allowed opacity-50"
                  : "bg-[#E11936] hover:bg-[#C71530]"
              }`}
              data-testid="button-end-match"
            >
              <img src={assets.adFlagIcon} className="w-4 h-4 sm:w-5 sm:h-5 xl:w-5 xl:h-5"></img>
              <div className="font-pretendard font-extrabold text-[14px] sm:text-[16px] xl:text-[20px] text-white text-center whitespace-nowrap">
                {(localMatchStatus || selectedMatch?.matchStatus) === "completed" ? "경기 종료됨" : "경기 종료"}
              </div>
            </button>
          </div>

          {/* Games Table */}
          <div>
            {/* Table Header */}
            <div className="grid grid-cols-7 px-4 py-3 bg-[#F9F9F9] text-sm font-medium text-[#4D4B4E] mb-2 mt-10">
              <div>게임</div>
              <div>예측 결과</div>
              <div>예측작수</div>
              <div>총 참여기록</div>
              <div>결과</div>
              <div>승리자수</div>
              <div>분배 참여기록</div>
            </div>

            {/* Table Body */}
            <div className="h-[400px] overflow-auto">
              {getRoundsToDisplay().map((round, index) => (
                <div
                  key={round.roundNumber}
                  className="grid grid-cols-7 px-4 py-5 bg-white border-b border-[#E9E9E9] text-sm text-[#201E22] items-center h-16"
                  data-testid={`game-row-${index}`}
                >
                  <div
                    className={`font-medium transition-all duration-300 ${
                      isTransitioning
                        ? "opacity-0 -translate-y-2"
                        : "opacity-100 translate-y-0"
                    }`}
                  >
                    {round.game}
                  </div>
                  <div
                    className={`transition-all duration-300 ${
                      isTransitioning
                        ? "opacity-0 -translate-y-2"
                        : "opacity-100 translate-y-0"
                    }`}
                  >
                    {round.predictStatus}
                  </div>
                  <div
                    className={`transition-all duration-300 ${
                      isTransitioning
                        ? "opacity-0 -translate-y-2"
                        : "opacity-100 translate-y-0"
                    }`}
                  >
                    {round.predictCount !== null ? round.predictCount : "--"}
                  </div>
                  <div
                    className={`transition-all duration-300 ${
                      isTransitioning
                        ? "opacity-0 -translate-y-2"
                        : "opacity-100 translate-y-0"
                    }`}
                  >
                    {round.totalPoint !== null
                      ? round.totalPoint.toLocaleString()
                      : "--"}
                  </div>
                  <div
                    className={`transition-all duration-300 ${
                      isTransitioning
                        ? "opacity-0 -translate-y-2"
                        : "opacity-100 translate-y-0"
                    }`}
                  >
                    {round.result}
                  </div>
                  <div
                    className={`transition-all duration-300 ${
                      isTransitioning
                        ? "opacity-0 -translate-y-2"
                        : "opacity-100 translate-y-0"
                    }`}
                  >
                    {round.winners !== null ? round.winners : "--"}
                  </div>
                  <div
                    className={`transition-all duration-300 ${
                      isTransitioning
                        ? "opacity-0 -translate-y-2"
                        : "opacity-100 translate-y-0"
                    }`}
                  >
                    {round.distributedPoint !== null
                      ? round.distributedPoint.toLocaleString()
                      : "--"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
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
