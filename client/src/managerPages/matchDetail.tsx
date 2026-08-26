import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import AdminConfirmPopup from "@/components/customUi/AdminConfirmPopup";
import { managerFetch, refreshAccessToken, dispatchManagerMatchEnded } from "@/lib/managerQueryClient";
import { getManagerAccessToken } from "@/lib/managerTokenManager";
import { useManagerAssets } from "@/contexts/ManagerAssetContext";
import { useToast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import TeamSeasonStatsModal from "@/components/TeamSeasonStatsModal";
import ManagerLineupEditor, { type LineupSide } from "@/components/ManagerLineupEditor";
import ManagerOperatorScorePanel from "@/components/ManagerOperatorScorePanel";
import ManagerPinchHitterEditor from "@/components/ManagerPinchHitterEditor";
import { setGameImmersiveMode } from "@/lib/systemUiPlugin";
import { resolveMatchTeamNames } from "@shared/matchTeamDisplay";
import { refreshGameKeepAwake, setGameKeepAwake } from "@/lib/screenWakeLock";
import { useManagerProactiveSessionRefresh } from "@/hooks/useManagerProactiveSessionRefresh";
import { useLiveScoreboard } from "@/hooks/useLiveScoreboard";
import { shouldClientPollMatch, msUntilMatchPollWindow } from "@/lib/matchPollWindow";
import { isMatchLiveWindowOpen } from "@shared/matchLiveWindow";
import { AD_PLAY_MS, resolveAdPlayingFromServer } from "@shared/adBreakTiming";
import { getDisplayStadiumName } from "@shared/stadiumDisplay";
import { resolveLiveInningPhaseLabel } from "@shared/matchPhaseDisplay";
import { speakGameVoice } from "@/lib/gameVoiceAnnouncements";
import { useQueryClient } from "@tanstack/react-query";
import { isLiveAutoOperatorWsType } from "@shared/liveAutoWsEvents";
import {
  WS_CLIENT_HEARTBEAT_INTERVAL_MS,
  WS_CLIENT_PONG_TIMEOUT_MS,
  inboundWsTrafficProvesAlive,
  isCurrentWsSocket,
  isWsConnectionReplacedCode,
  isWsNormalCloseCode,
  shouldCloseForPongTimeout,
} from "@shared/wsHeartbeat";
import "./managerMatchDetail.css";

const WS_BASE_URL = 'wss://ppamong.com';
const PREDICTION_TOGGLE_MS = 1000;
const RESULT_BUTTONS = ["1루", "2루", "3루", "홈런", "아웃", "병살", "삼살"] as const;

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
  /** 실황 타석 자동(상태머신) — 기본 true */
  liveAutoEnabled?: boolean;
  atBatPhase?: "idle" | "prediction_open" | "prediction_closed" | "result_confirmed";
  atBatPhaseLabel?: string;
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
    home?: Array<{ battingOrder: number; name: string; playerId?: number; rosterPlayerId?: string }>;
    away?: Array<{ battingOrder: number; name: string; playerId?: number; rosterPlayerId?: string }>;
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
      position?: string | null;
      note?: string | null;
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
  const [suggestedAutoResult, setSuggestedAutoResult] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  const [adElapsedTime, setAdElapsedTime] = useState(0);
  const adStartTimeRef = useRef<number | null>(null);
  const adExpiredStopSentRef = useRef(false);
  const [isStartingPrediction, setIsStartingPrediction] = useState(false);
  const [isStoppingPrediction, setIsStoppingPrediction] = useState(false);
  const [advanceBusy, setAdvanceBusy] = useState<"next" | "switch" | "pitcher" | null>(null);
  const [startToggleAt, setStartToggleAt] = useState(0);
  const [toggleTick, setToggleTick] = useState(0);
  const [showPredictionDisabledPopup, setShowPredictionDisabledPopup] =
    useState(false);
  const [showAdPlayingPopup, setShowAdPlayingPopup] = useState(false);
  const [lineupEditorSide, setLineupEditorSide] = useState<LineupSide | null>(null);
  const [teamStatsSide, setTeamStatsSide] = useState<"home" | "away" | null>(null);
  const [pinchEditorOpen, setPinchEditorOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [managerId, setManagerId] = useState<string | null>(null);
  const { data: scoreboardPayload } = useLiveScoreboard(id ?? null, {
    startTime: match?.startTime,
    matchStatus: match?.matchStatus,
    pollMs: 2_000,
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
  /** 버튼 직후 로컬 반영분과 겹치는 WS GET 중복 방지 */
  const skipRemoteDetailUntilRef = useRef(0);
  const threeOutsSpokenRef = useRef(false);
  const operatorConfirmSpokenRef = useRef(false);
  const [showMatchEndedOverlay, setShowMatchEndedOverlay] = useState(false);
  const matchEndedLogoutRef = useRef(false);
  const HEARTBEAT_INTERVAL = WS_CLIENT_HEARTBEAT_INTERVAL_MS;
  const PONG_TIMEOUT = WS_CLIENT_PONG_TIMEOUT_MS;

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
    void speakGameVoice("operator.matchEnded", 8_000);
    setShowMatchEndedOverlay(true);
    window.setTimeout(() => {
      dispatchManagerMatchEnded("담당 경기가 종료되어 로그아웃됩니다.");
    }, 10_000);
  }, []);

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

      const prev = wsRef.current;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      if (prev && prev !== ws) {
        try {
          prev.close(1000, "replaced");
        } catch {
          /* ignore */
        }
      }

      const clearPongTimeout = () => {
        if (pongTimeoutRef.current) {
          clearTimeout(pongTimeoutRef.current);
          pongTimeoutRef.current = null;
        }
      };

      const sendPing = () => {
        if (ws.readyState !== WebSocket.OPEN) return;
        if (!isCurrentWsSocket(wsRef.current, ws)) return;
        ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
        console.log("[Manager WS] Ping 전송");
        clearPongTimeout();
        pongTimeoutRef.current = setTimeout(() => {
          if (!shouldCloseForPongTimeout({ pingSocket: ws, currentSocket: wsRef.current })) {
            return;
          }
          console.log("[Manager WS] Pong 타임아웃, 재연결...");
          ws.close(4000, "heartbeat timeout");
        }, PONG_TIMEOUT);
      };

      ws.onopen = () => {
        console.log("[Manager WS] 연결됨");
        setWsConnected(true);
        reconnectAttemptsRef.current = 0;
        sessionExpiredRef.current = false;
        duplicateLoginRef.current = false;
        isUnmountingRef.current = false;

        // 즉시 ping 하지 않음 — 서버 connected 스냅샷(DB) 전에 보내면 유실될 수 있음.
        // 아무 inbound 메시지든 keepalive로 치고, 이후 25초마다 ping.
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        heartbeatIntervalRef.current = setInterval(sendPing, HEARTBEAT_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const { type, data } = message;

          if (inboundWsTrafficProvesAlive(type) && pongTimeoutRef.current) {
            clearTimeout(pongTimeoutRef.current);
            pongTimeoutRef.current = null;
          }

          switch (type) {
            case "connected":
              console.log("[Manager WS] 서버 연결 확인:", data);
              {
                const resolved = resolveAdPlayingFromServer(data?.isAdPlaying, data?.adStartedAt);
                setIsAdPlaying(resolved.playing);
                adStartTimeRef.current = resolved.startedAt;
                setAdElapsedTime(resolved.elapsedSec);
                adExpiredStopSentRef.current = false;
              }
              break;
            case "pong":
            case "heartbeat_ack":
              break;
            case "ad_started":
              console.log("[Manager WS] 광고 시작");
              {
                const resolved = resolveAdPlayingFromServer(true, data?.adStartedAt ?? Date.now());
                setIsAdPlaying(resolved.playing);
                adStartTimeRef.current = resolved.startedAt;
                setAdElapsedTime(resolved.elapsedSec);
                adExpiredStopSentRef.current = false;
              }
              break;
            case "ad_stopped":
              console.log("[Manager WS] 광고 중지");
              setIsAdPlaying(false);
              setAdElapsedTime(0);
              adStartTimeRef.current = null;
              adExpiredStopSentRef.current = false;
              break;
            case "ad_status":
              console.log("[Manager WS] 광고 상태:", data);
              {
                const resolved = resolveAdPlayingFromServer(data?.isAdPlaying, data?.adStartedAt);
                setIsAdPlaying(resolved.playing);
                adStartTimeRef.current = resolved.startedAt;
                setAdElapsedTime(resolved.elapsedSec);
                if (!resolved.playing) adExpiredStopSentRef.current = false;
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
            case "scoreboard_update":
              void queryClient.invalidateQueries({ queryKey: ["live-scoreboard", id] });
              fetchMatchDetail();
              break;
            case "auto_result_suggested":
              if (data?.suggestedResult) {
                const result = String(data.suggestedResult);
                setSuggestedAutoResult(result);
                setSelectedResult(result);
                toast({
                  description:
                    data.message || `실황 추정 결과: ${result} — 자동 확정 대기 (필요하면 1탭)`,
                });
              }
              fetchMatchDetail();
              break;
            case "auto_action_suggested":
              toast({
                description: data?.message || "실황 감지 — 1탭으로 확정할 수 있습니다.",
              });
              fetchMatchDetail();
              break;
            case "auto_result_timeout":
              toast({
                variant: "destructive",
                description: data?.message || "결과가 감지되지 않습니다. 수동으로 결과를 입력해 주세요.",
              });
              if (data?.suggestedResult) {
                setSuggestedAutoResult(String(data.suggestedResult));
                setSelectedResult(String(data.suggestedResult));
              }
              fetchMatchDetail();
              break;
            case "auto_action_blocked":
              toast({
                variant: "destructive",
                description: data?.message || "자동 진행을 위해 결과가 필요합니다.",
              });
              if (data?.suggestedResult) {
                setSuggestedAutoResult(String(data.suggestedResult));
                setSelectedResult(String(data.suggestedResult));
              }
              if (!operatorConfirmSpokenRef.current) {
                operatorConfirmSpokenRef.current = true;
                void speakGameVoice("operator.confirmResult", 5_000);
              }
              fetchMatchDetail();
              break;
            case "auto_pinch_suggested":
              toast({
                description: data?.message || "대타 후보가 감지되었습니다.",
              });
              break;
            case "at_bat_phase":
              if (data?.phase || data?.phaseLabel) {
                setMatch((prev) => {
                  if (!prev) return prev;
                  const next = {
                    ...prev,
                    atBatPhase: data.phase ?? prev.atBatPhase,
                    atBatPhaseLabel: data.phaseLabel ?? prev.atBatPhaseLabel,
                  };
                  if (data.phase === "prediction_open") {
                    operatorConfirmSpokenRef.current = false;
                  }
                  return next;
                });
              }
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
            case "rewarded_ad_offer":
            case "banner_ad_show":
            case "banner_ad_hide":
              break;
            default:
              if (typeof type === "string" && isLiveAutoOperatorWsType(type)) {
                break;
              }
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
        if (!isCurrentWsSocket(wsRef.current, ws)) {
          console.log("[Manager WS] 교체된 소켓 종료 무시");
          return;
        }
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

        // 세션 종료 (4005) — 사용자 앱과 같이 토큰 갱신 후 재연결. 진짜 만료일 때만 로그아웃.
        if (event.code === 4005) {
          if (sessionExpiredRef.current || duplicateLoginRef.current || isUnmountingRef.current) {
            return;
          }
          console.log("[Manager WS] 4005 — 토큰 갱신 후 재연결 시도");
          reconnectTimeoutRef.current = setTimeout(async () => {
            if (
              sessionExpiredRef.current ||
              duplicateLoginRef.current ||
              isUnmountingRef.current
            ) {
              return;
            }
            const ok = await refreshAccessToken();
            if (!ok) {
              if (sessionExpiredRef.current) return;
              sessionExpiredRef.current = true;
              console.log("[Manager WS] 4005 갱신 실패, 로그인 페이지로 이동");
              window.dispatchEvent(new CustomEvent("manager-session-expired"));
              return;
            }
            void connectFnRef.current?.();
          }, 400);
          return;
        }

        // 세션 없음 (4006) - 재시도 없이 로그인 페이지로
        if (event.code === 4006) {
          if (sessionExpiredRef.current) return;
          sessionExpiredRef.current = true;
          console.log("[Manager WS] 세션 없음, 로그인 페이지로 이동:", event.code);
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

        // 같은 운영자 재접속으로 서버가 기존 소켓을 교체 (4010) — 새 연결이 이미 있음
        if (isWsConnectionReplacedCode(event.code)) {
          console.log("[Manager WS] 연결이 새 소켓으로 교체됨, 재연결 생략");
          return;
        }

        // 비정상 종료 시 재연결 — 네트워크 끊김으로 토큰 갱신이 실패해도 로그아웃하지 않음
        // (refreshAccessToken이 진짜 인증 만료일 때만 스스로 manager-session-expired 발행)
        if (!isWsNormalCloseCode(event.code)) {
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
    if (!isPolling && Date.now() < skipRemoteDetailUntilRef.current) {
      return;
    }
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
          void speakGameVoice("operator.threeOuts");
        }
        if (!data.showThreeOutsHint) {
          threeOutsSpokenRef.current = false;
        }
      } else if (response.status === 429) {
        console.log("[Manager] 요청 제한 (429) - 무시하고 기존 데이터 유지");
      } else if (response.status === 403) {
        const data = await response.json();
        if (data.deactivated || data.matchEnded) {
          logoutOnMatchEnded();
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

  // 경기 시작 5분 전부터 MongoDB 폴링 (선택 경기 1건)
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

  const submitPredictionResult = async (result: string) => {
    setSuggestedAutoResult(null);
    setIsSubmitting(true);
    try {
      const response = await managerFetch(`/api/manager/matches/${id}/result`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ result }),
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedResult(null);
        if (data.threeOutsReached) {
          threeOutsSpokenRef.current = true;
          void speakGameVoice("operator.threeOuts");
          toast({ description: "결과가 전송되었습니다. 공수교대를 기다립니다." });
        } else {
          toast({ description: "결과가 전송되었습니다. 다음 타자를 기다립니다." });
        }
        if (match) {
          setMatch({
            ...match,
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

  const handleConfirmResult = async () => {
    if (!selectedResult || isSubmitting) return;
    await submitPredictionResult(selectedResult);
  };

  const handleAdvanceRound = async (
    path: string,
    failMessage: string,
    action: "next" | "switch" | "pitcher",
    options?: { onSuccess?: (data: Record<string, unknown>) => void },
  ) => {
    if (advanceBusy) return;
    if (isAdPlaying) {
      handleStopAd();
      return;
    }
    setAdvanceBusy(action);
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
      const phase = data.gamePhase as {
        gameInning?: number;
        inningHalf?: string;
        batterIndexInHalf?: number;
        currentRound?: number;
      } | undefined;
      skipRemoteDetailUntilRef.current = Date.now() + 2000;
      setMatch((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          currentRound: (data.currentRound as number | undefined) ?? phase?.currentRound ?? prev.currentRound,
          gameInning: phase?.gameInning ?? prev.gameInning,
          inningHalf: phase?.inningHalf ?? prev.inningHalf,
          batterIndexInHalf: phase?.batterIndexInHalf ?? prev.batterIndexInHalf,
          predictionEnabled: false,
          predictionStartTime: undefined,
          predictionStopTime: undefined,
          needsResultBeforeAdvance: false,
          needsAdvanceAfterResult: false,
          isResultSent: false,
          showThreeOutsHint: false,
          outsInHalf: action === "switch" ? 0 : prev.outsInHalf,
          pinchHitter: null,
        };
      });
      void fetchMatchDetail(true);
    } catch {
      toast({ variant: "destructive", description: failMessage });
    } finally {
      setAdvanceBusy(null);
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
    if (!awaitAdvanceAfterResult) {
      toast({ description: "실황이 다음 타자로 진행합니다. 결과가 나온 뒤에만 직접 누르세요." });
      return;
    }
    void handleAdvanceRound(
      `/api/manager/control/${id}/round/next-batter`,
      "다음 타자 처리에 실패했습니다.",
      "next",
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
      "pitcher",
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
    if (
      !showThreeOutsHint &&
      (match?.outsInHalf ?? 0) < 3 &&
      !awaitAdvanceAfterResult
    ) {
      toast({ description: "3아웃일 때만 공수교대합니다. 그 전에는 실황이 진행합니다." });
      return;
    }
    void handleAdvanceRound(
      `/api/manager/control/${id}/round/switch-half`,
      "공수교대 처리에 실패했습니다.",
      "switch",
      {
        onSuccess: () => {
          threeOutsSpokenRef.current = false;
        },
      },
    );
  };

  // 광고 타이머 (서버 시작 시각 기반으로 정확한 경과 시간 계산). AD_PLAY_MS면 로컬도 종료.
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
      if (!adStartTimeRef.current) return;
      const elapsed = Math.max(0, Math.floor((Date.now() - adStartTimeRef.current) / 1000));
      setAdElapsedTime(elapsed);
      if (elapsed >= Math.round(AD_PLAY_MS / 1000)) {
        setIsAdPlaying(false);
        setAdElapsedTime(0);
        adStartTimeRef.current = null;
        if (!adExpiredStopSentRef.current) {
          adExpiredStopSentRef.current = true;
          void managerFetch(`/api/manager/matches/${id}/ad/stop`, { method: "POST" }).catch(
            () => undefined,
          );
        }
      }
    }, 500);

    return () => clearInterval(timer);
  }, [isAdPlaying, id]);

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
    scoreboard:
      scoreboardPayload?.scoreboard ?? match.liveScoreboard ?? null,
  });
  const blockAdvance = Boolean(match.needsResultBeforeAdvance);
  const awaitAdvanceAfterResult = Boolean(
    match.needsAdvanceAfterResult || match.isResultSent,
  );
  const showThreeOutsHint = Boolean(match.showThreeOutsHint);
  /** 경기중(ongoing) 또는 시작 5분 전~(scheduled) */
  const isMatchLive =
    match.matchStatus === "ongoing" ||
    (match.matchStatus === "scheduled" && isMatchLiveWindowOpen(match.startTime));
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
  const anyAdvanceBusy = Boolean(advanceBusy);
  /** 공수교대(3아웃) 제외 — 예측 시작·중지 중에도 투수 교체 가능. 결과 전송 후에도 수동 가능. */
  const canPitcherChange =
    isMatchLive &&
    !showThreeOutsHint &&
    !anyAdvanceBusy &&
    !isAdPlaying;
  /** 다음 타자 — 결과 전송 후에만. 대기 중에는 실황 자동. 3아웃이면 공수교대만 */
  const canNextBatter =
    isMatchLive &&
    !showThreeOutsHint &&
    !anyAdvanceBusy &&
    !blockAdvanceActions &&
    !isAdPlaying &&
    awaitAdvanceAfterResult;
  /** 공수 교대 — 3아웃(또는 힌트)일 때만. 미결과면 먼저 결과 */
  const canSwitchHalf =
    isMatchLive &&
    !anyAdvanceBusy &&
    !blockAdvanceActions &&
    !isAdPlaying &&
    (showThreeOutsHint || (match.outsInHalf ?? 0) >= 3 || awaitAdvanceAfterResult);
  /** 대타 — 경기중·예측 중이 아닐 때 (현재 타석 교체) */
  const canSetPinchHitter =
    isMatchLive && !anyAdvanceBusy && !predictionRunning && !isAdPlaying;

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
            onTeamClick={(side) => setTeamStatsSide(side)}
            onLineupClick={(side) => setLineupEditorSide(side)}
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
        </div>

        <div className="manager-match-controls">
          <div className="manager-match-control-col">
            <button
              type="button"
              onClick={handleStartPrediction}
              disabled={!canStartPrediction}
              data-testid="button-start-prediction"
              aria-label={
                !isMatchLive
                  ? "경기전"
                  : isStartingPrediction
                    ? "예측 시작 처리중"
                    : withinStartCancel
                      ? "시작 취소"
                      : predictionRunning
                        ? "예측 중"
                        : "예측 시작"
              }
              className={`manager-match-action-btn manager-match-action-btn--start ${
                withinStartCancel ? "manager-match-action-btn--toggle" : ""
              }`}
            >
              <img
                src={assets.startPrediction}
                className="manager-match-action-mascot"
                alt=""
              />
              <span className="manager-match-action-label">
                {!isMatchLive
                  ? "경기전"
                  : isStartingPrediction
                    ? "처리중"
                    : withinStartCancel
                      ? "시작 취소"
                      : predictionRunning
                        ? "예측 중"
                        : "시작"}
              </span>
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
            <button
              type="button"
              onClick={handleStopPrediction}
              disabled={!canStopPrediction}
              data-testid="button-stop-prediction"
              aria-label={
                !isMatchLive
                  ? "경기전"
                  : isStoppingPrediction
                    ? "예측 중지 처리중"
                    : "예측 중지"
              }
              className="manager-match-action-btn manager-match-action-btn--stop"
            >
              <img
                src={assets.stopPrediction}
                className="manager-match-action-mascot"
                alt=""
              />
              <span className="manager-match-action-label">
                {!isMatchLive
                  ? "경기전"
                  : isStoppingPrediction
                    ? "처리중"
                    : "중지"}
              </span>
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
          <div className="manager-match-result-row">
            {RESULT_BUTTONS.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setSuggestedAutoResult(null);
                  handleResultSelect(label);
                }}
                disabled={!canSelectResult}
                data-testid={`button-result-${label}`}
                className={`manager-match-result-btn ${
                  selectedResult === label || suggestedAutoResult === label
                    ? "manager-match-result-btn--selected"
                    : ""
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
              3아웃 — 공수교대 (실황이 진행, 막히면 직접)
            </div>
          )}

          {!showThreeOutsHint && awaitAdvanceAfterResult && (
            <div
              className="manager-match-notice"
              data-testid="text-await-next-batter"
              style={{ background: "#E8F5E9", color: "#2E7D32" }}
            >
              결과 전송됨 — 실황이 다음 타자로 진행합니다
            </div>
          )}

          <div className="manager-match-bottom-grid">
            {isAdPlaying ? (
              <button
                type="button"
                onClick={() => handleStopAd()}
                data-testid="button-stop-ad"
                className="manager-match-bottom-btn manager-match-bottom-btn--ad-stop"
              >
                광고 종료
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleNextBatter()}
                  disabled={!canNextBatter}
                  data-testid="button-next-batter"
                  className="manager-match-bottom-btn bg-[#4285F4]"
                >
                  {advanceBusy === "next" ? "처리중" : "다음\n타자"}
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchHalf()}
                  disabled={!canSwitchHalf}
                  data-testid="button-switch-half"
                  className={`manager-match-bottom-btn bg-[#E11936] ${
                    showThreeOutsHint ? "manager-match-bottom-btn--pulse" : ""
                  }`}
                >
                  {advanceBusy === "switch" ? "처리중" : "공수\n교대"}
                </button>
                <button
                  type="button"
                  onClick={() => handlePitcherChange()}
                  disabled={!canPitcherChange}
                  data-testid="button-pitcher-change"
                  className="manager-match-bottom-btn bg-[#5C6BC0]"
                >
                  {advanceBusy === "pitcher" ? "처리중" : "투수\n교체"}
                </button>
              </>
            )}
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
      {showMatchEndedOverlay && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70"
          data-testid="manager-match-ended-overlay"
        >
          <p className="text-white text-[clamp(2rem,10vw,3.5rem)] font-black tracking-tight">
            경기종료
          </p>
        </div>
      )}

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

      {teamStatsSide && match ? (
        <TeamSeasonStatsModal
          open
          teamName={teamStatsSide === "away" ? awayTeamName : homeTeamName}
          stats={
            (teamStatsSide === "away"
              ? scoreboardPayload?.teamSeasonStats?.away
              : scoreboardPayload?.teamSeasonStats?.home) ?? null
          }
          onClose={() => setTeamStatsSide(null)}
        />
      ) : null}

      {pinchEditorOpen && id ? (
        <ManagerPinchHitterEditor
          matchId={id}
          side={match.inningHalf === "bottom" ? "home" : "away"}
          teamLabel={match.inningHalf === "bottom" ? homeTeamName : awayTeamName}
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
