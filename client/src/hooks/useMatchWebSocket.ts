import { useEffect, useRef, useCallback, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { getOrRefreshAccessToken } from "@/lib/queryClient";
import { isUserSessionReplaced, notifyUserDuplicateLoginSafe, notifyUserLoginAttemptSafe, markUserSessionReplaced } from "@/lib/sessionGuard";
import { clearTokens } from "@/lib/tokenManager";
import { subscribeForegroundResume } from "@/lib/foregroundResume";
import { isLiveAutoOperatorWsType } from "@shared/liveAutoWsEvents";
import {
  WS_CLIENT_HEARTBEAT_INTERVAL_MS,
  WS_CLIENT_PONG_TIMEOUT_MS,
  inboundWsTrafficProvesAlive,
  isCurrentWsSocket,
  shouldCloseForPongTimeout,
} from "@shared/wsHeartbeat";
import {
  WS_QUICK_ABNORMAL_CLOSE_LIMIT,
  nextQuickAbnormalCloseCount,
  shouldResetWsReconnectAttemptsOnOpen,
  shouldSkipForegroundWsResume,
  shouldStopUserWsReconnect,
} from "@shared/wsUserReconnect";

export type WSConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting";

// 네이티브 앱용 WebSocket URL
const WS_BASE_URL = 'wss://ppamong.com';

export interface WSEventHandlers {
  onConnected?: (data: any) => void;
  onPredictionStarted?: (data: any) => void;
  onPredictionEnded?: (data: any) => void;
  /** 예측 시작 취소(1초 내) — 환불 포함 */
  onPredictionCancelled?: (data: any) => void;
  onRoundResult?: (data: any) => void;
  onStatsUpdate?: (data: any) => void;
  onUserAlreadyPredicted?: (data: any) => void;
  onWaitingScreenUpdate?: (data: any) => void;
  onAdStarted?: (data: any) => void | Promise<void>;
  onAdStopped?: (data: any) => void;
  onAdStatus?: (data: any) => void;
  onRoundNext?: (data: any) => void;
  onMatchEnd?: (data: any) => void;
  onPinchHitterSet?: (data: any) => void;
  onPinchHitterCleared?: (data: any) => void;
  onScoreboardUpdate?: (data: any) => void;
  onRewardedAdOffer?: (data: any) => void | Promise<void>;
  onAtBatPhase?: (data: {
    phase?: string;
    atBatPhase?: string;
    uiStage?: string;
    stage?: string;
    matchId?: string;
    currentRound?: number;
    settledResult?: string | null;
  }) => void;
  onGameSuspended?: (data: any) => void;
  onGameResumed?: (data: any) => void;
  onError?: (error: Error) => void;
  onReconnecting?: (attempt: number) => void;
}

interface UseMatchWebSocketOptions {
  matchId: string | null;
  userId: string | null;
  handlers: WSEventHandlers;
  autoConnect?: boolean;
}

interface UseMatchWebSocketResult {
  connectionState: WSConnectionState;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 50;
const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;
const HEARTBEAT_INTERVAL = WS_CLIENT_HEARTBEAT_INTERVAL_MS;
const PONG_TIMEOUT = WS_CLIENT_PONG_TIMEOUT_MS;

/** 같은 탭에서 훅이 두 번 떠도 소켓은 하나 — 서버 4010(프록시는 1006) 서로 차기 방지 */
let sharedUserMatchWs: WebSocket | null = null;

function replaceSharedUserMatchWs(next: WebSocket | null): void {
  if (sharedUserMatchWs && sharedUserMatchWs !== next) {
    const prev = sharedUserMatchWs;
    sharedUserMatchWs = next;
    try {
      if (prev.readyState === WebSocket.OPEN || prev.readyState === WebSocket.CONNECTING) {
        prev.close(1000, "Superseded");
      }
    } catch {
      /* ignore */
    }
    return;
  }
  sharedUserMatchWs = next;
}

export function useMatchWebSocket({
  matchId,
  userId,
  handlers,
  autoConnect = true,
}: UseMatchWebSocketOptions): UseMatchWebSocketResult {
  const [connectionState, setConnectionState] = useState<WSConnectionState>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const pongTimeout = useRef<NodeJS.Timeout | null>(null);
  const handlersRef = useRef(handlers);
  const isIntentionalClose = useRef(false);
  const matchIdRef = useRef(matchId);
  const userIdRef = useRef(userId);
  const connectRef = useRef<() => void>(() => {});
  const pingAfterReadyRef = useRef<(() => void) | null>(null);
  const lastOpenAtMs = useRef<number | null>(null);
  const openedAtMs = useRef<number | null>(null);
  const consecutiveQuickAbnormalCloses = useRef(0);
  const didForceRefreshOnQuickClose = useRef(false);

  handlersRef.current = handlers;
  matchIdRef.current = matchId;
  userIdRef.current = userId;

  const clearTimers = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
    }
    if (pongTimeout.current) {
      clearTimeout(pongTimeout.current);
      pongTimeout.current = null;
    }
  }, []);

  const startHeartbeat = useCallback((ws: WebSocket) => {
    clearTimers();

    const sendPing = () => {
      if (ws.readyState !== WebSocket.OPEN || !isCurrentWsSocket(wsRef.current, ws)) return;
      ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
      if (pongTimeout.current) {
        clearTimeout(pongTimeout.current);
      }
      pongTimeout.current = setTimeout(() => {
        if (!shouldCloseForPongTimeout({ pingSocket: ws, currentSocket: wsRef.current })) {
          return;
        }
        console.log("[WS] Pong timeout, reconnecting...");
        ws.close(4000, "heartbeat timeout");
      }, PONG_TIMEOUT);
    };

    heartbeatInterval.current = setInterval(sendPing, HEARTBEAT_INTERVAL);
    pingAfterReadyRef.current = sendPing;
    return sendPing;
  }, [clearTimers]);

  const scheduleReconnect = useCallback(() => {
    if (isIntentionalClose.current) return;
    if (isUserSessionReplaced()) {
      console.log("[WS] Stop reconnect — session replaced by another device");
      setConnectionState("disconnected");
      return;
    }
    if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
      console.log("[WS] Max reconnect attempts reached");
      setConnectionState("disconnected");
      handlersRef.current.onError?.(new Error("최대 재연결 시도 횟수를 초과했습니다."));
      return;
    }

    reconnectAttempts.current++;
    const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts.current - 1), RECONNECT_MAX_DELAY);
    console.log(`[WS] Scheduling reconnect attempt ${reconnectAttempts.current} in ${delay}ms`);

    setConnectionState("reconnecting");
    handlersRef.current.onReconnecting?.(reconnectAttempts.current);

    reconnectTimeout.current = setTimeout(() => {
      connectRef.current();
    }, delay);
  }, []);

  const connect = useCallback(async () => {
    const currentMatchId = matchIdRef.current;
    const currentUserId = userIdRef.current;

    if (!currentMatchId || !currentUserId) {
      console.log("[WS] Missing matchId or userId");
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("[WS] Already connected");
      return;
    }

    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log("[WS] Already connecting");
      return;
    }

    clearTimers();
    isIntentionalClose.current = false;
    setConnectionState("connecting");

    try {
      const token = await getOrRefreshAccessToken();
      if (!token) {
        console.log("[WS] No access token available after refresh attempt");
        setConnectionState("disconnected");
        if (!isUserSessionReplaced()) {
          handlersRef.current.onError?.(new Error("인증 토큰이 없습니다. 다시 로그인해주세요."));
        }
        return;
      }

      if (matchIdRef.current !== currentMatchId || userIdRef.current !== currentUserId) {
        console.log("[WS] matchId/userId changed during token refresh, aborting stale connect");
        return;
      }

      if (isIntentionalClose.current) {
        console.log("[WS] Connection was intentionally closed during token refresh, aborting");
        return;
      }

      let wsUrl: string;
      if (Capacitor.isNativePlatform()) {
        wsUrl = `${WS_BASE_URL}/ws/match?matchId=${currentMatchId}&token=${token}`;
      } else {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.host;
        wsUrl = `${protocol}//${host}/ws/match?matchId=${currentMatchId}&token=${token}`;
      }

      console.log(`[WS] Connecting to ${wsUrl.replace(token, "***")}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      replaceSharedUserMatchWs(ws);

      ws.onopen = () => {
        console.log("[WS] Connection opened");
        const now = Date.now();
        lastOpenAtMs.current = now;
        openedAtMs.current = now;
        setConnectionState("connected");
        if (shouldResetWsReconnectAttemptsOnOpen()) {
          reconnectAttempts.current = 0;
        }
        startHeartbeat(ws);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (inboundWsTrafficProvesAlive(message.type) && pongTimeout.current) {
            clearTimeout(pongTimeout.current);
            pongTimeout.current = null;
          }

          switch (message.type) {
            case "connected":
              pingAfterReadyRef.current?.();
              reconnectAttempts.current = 0;
              consecutiveQuickAbnormalCloses.current = 0;
              didForceRefreshOnQuickClose.current = false;
              handlersRef.current.onConnected?.(message.data);
              break;
            case "prediction_started":
              handlersRef.current.onPredictionStarted?.(message.data);
              break;
            case "prediction_ended":
            case "prediction_stopped":
              handlersRef.current.onPredictionEnded?.(message.data);
              break;
            case "prediction_cancelled":
              handlersRef.current.onPredictionCancelled?.(message.data);
              break;
            case "round_result":
              handlersRef.current.onRoundResult?.(message.data);
              break;
            case "stats_update":
              handlersRef.current.onStatsUpdate?.(message.data);
              break;
            case "user_already_predicted":
              handlersRef.current.onUserAlreadyPredicted?.(message.data);
              break;
            case "waiting_screen_update":
              handlersRef.current.onWaitingScreenUpdate?.(message.data);
              break;
            case "ad_started":
              handlersRef.current.onAdStarted?.(message.data);
              break;
            case "ad_stopped":
              handlersRef.current.onAdStopped?.(message.data);
              break;
            case "ad_status":
              handlersRef.current.onAdStatus?.(message.data);
              break;
            case "round_next":
              handlersRef.current.onRoundNext?.(message.data);
              break;
            case "pinch_hitter_set":
              handlersRef.current.onPinchHitterSet?.(message.data);
              break;
            case "pinch_hitter_cleared":
              handlersRef.current.onPinchHitterCleared?.(message.data);
              break;
            case "scoreboard_update":
              handlersRef.current.onScoreboardUpdate?.(message.data);
              break;
            case "rewarded_ad_offer":
              handlersRef.current.onRewardedAdOffer?.(message.data);
              break;
            case "banner_ad_show":
            case "banner_ad_hide":
              break;
            case "login_attempt":
              notifyUserLoginAttemptSafe();
              break;
            case "match_ended":
              handlersRef.current.onMatchEnd?.(message.data);
              break;
            case "end":
              handlersRef.current.onMatchEnd?.(message.data);
              break;
            case "game_suspended":
              handlersRef.current.onGameSuspended?.(message.data);
              break;
            case "game_resumed":
              handlersRef.current.onGameResumed?.(message.data);
              break;
            case "at_bat_phase":
              handlersRef.current.onAtBatPhase?.(message.data);
              break;
            case "pong":
            case "heartbeat_ack":
              break;
            default:
              if (typeof message.type === "string" && isLiveAutoOperatorWsType(message.type)) {
                break;
              }
              console.log("[WS] Unknown message type:", message.type);
          }
        } catch (error) {
          console.error("[WS] Error parsing message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("[WS] WebSocket error:", error);
        // onerror는 항상 onclose가 뒤따르므로 onError 콜백은 onclose에서만 호출
        // (백그라운드/화면 off 시 불필요한 에러 toast 방지)
      };

      ws.onclose = (event) => {
        console.log(`[WS] Connection closed: code=${event.code}, reason=${event.reason}`);
        // 경기 전환으로 교체된 소켓 — 1006이어도 재연결하지 않음 (heartbeat도 건드리지 않음)
        if (wsRef.current !== ws) {
          console.log("[WS] Ignoring close from replaced socket");
          return;
        }
        if (sharedUserMatchWs && sharedUserMatchWs !== ws) {
          console.log("[WS] Ignoring close — another socket is active");
          wsRef.current = null;
          return;
        }
        if (event.reason === "Superseded") {
          console.log("[WS] Closed as superseded, not reconnecting");
          clearTimers();
          wsRef.current = null;
          if (sharedUserMatchWs === ws) sharedUserMatchWs = null;
          setConnectionState("disconnected");
          return;
        }
        clearTimers();
        wsRef.current = null;
        if (sharedUserMatchWs === ws) sharedUserMatchWs = null;

        consecutiveQuickAbnormalCloses.current = nextQuickAbnormalCloseCount({
          closeCode: event.code,
          openedAtMs: openedAtMs.current,
          closedAtMs: Date.now(),
          previousCount: consecutiveQuickAbnormalCloses.current,
        });
        openedAtMs.current = null;

        const sessionReplaced = isUserSessionReplaced();
        if (
          shouldStopUserWsReconnect({
            closeCode: event.code,
            sessionReplaced,
            consecutiveQuickAbnormalCloses: consecutiveQuickAbnormalCloses.current,
          })
        ) {
          console.log(`[WS] Close code ${event.code} - not reconnecting`);
          setConnectionState("disconnected");
          if (event.code === 4008 || sessionReplaced) {
            if (event.code === 4008) {
              markUserSessionReplaced();
              void clearTokens();
            }
            notifyUserDuplicateLoginSafe();
          } else if (event.code === 4007) {
            handlersRef.current.onError?.(new Error("비활성화된 계정입니다."));
          } else if (event.code === 4006) {
            handlersRef.current.onError?.(new Error("세션이 만료되었습니다."));
          }
          return;
        }

        if (event.code === 4005) {
          // 세션 종료 — 만료·교체 모두 가능. force refresh 후 재연결 (만료 토큰으로 4002 방지).
          console.log("[WS] Session terminated (4005) - attempting reconnect with fresh token");
          void (async () => {
            const fresh = await getOrRefreshAccessToken({ forceRefresh: true });
            if (!fresh || isUserSessionReplaced()) {
              console.log("[WS] No fresh token after 4005 — stopping reconnect");
              setConnectionState("disconnected");
              handlersRef.current.onError?.(
                new Error("세션이 만료되었습니다. 다시 로그인해주세요."),
              );
              return;
            }
            scheduleReconnect();
          })();
          return;
        }

        if (!isIntentionalClose.current && event.code !== 1000) {
          if (
            consecutiveQuickAbnormalCloses.current >= WS_QUICK_ABNORMAL_CLOSE_LIMIT &&
            !didForceRefreshOnQuickClose.current
          ) {
            didForceRefreshOnQuickClose.current = true;
            console.log("[WS] Repeated immediate 1006 — forcing token refresh once");
            void (async () => {
              const fresh = await getOrRefreshAccessToken({ forceRefresh: true });
              if (!fresh || isUserSessionReplaced()) {
                console.log("[WS] Stop reconnect after quick-close refresh");
                setConnectionState("disconnected");
                return;
              }
              scheduleReconnect();
            })();
            return;
          }
          scheduleReconnect();
        } else {
          setConnectionState("disconnected");
        }
      };
    } catch (error) {
      console.error("[WS] Error creating WebSocket:", error);
      setConnectionState("disconnected");
      handlersRef.current.onError?.(error as Error);
    }
  }, [clearTimers, startHeartbeat, scheduleReconnect]);

  connectRef.current = connect;

  const disconnect = useCallback(() => {
    console.log("[WS] Intentional disconnect");
    isIntentionalClose.current = true;
    clearTimers();
    reconnectAttempts.current = 0;

    if (wsRef.current) {
      const old = wsRef.current;
      wsRef.current = null;
      if (sharedUserMatchWs === old) sharedUserMatchWs = null;
      old.close(1000, "User disconnect");
    }
    setConnectionState("disconnected");
  }, [clearTimers]);

  const reconnect = useCallback(() => {
    disconnect();
    isIntentionalClose.current = false;
    reconnectAttempts.current = 0;
    setTimeout(() => connect(), 100);
  }, [disconnect, connect]);

  // 컴포넌트 마운트 상태 추적
  const isMountedRef = useRef(true);
  const prevMatchIdRef = useRef<string | null>(null);
  const prevUserIdRef = useRef<string | null>(null);

  // 컴포넌트 언마운트 시에만 연결 종료
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      console.log("[WS] Component unmounting, closing connection");
      isIntentionalClose.current = true;
      clearTimers();
      reconnectAttempts.current = 0;
      if (wsRef.current) {
        const old = wsRef.current;
        wsRef.current = null;
        if (sharedUserMatchWs === old) {
          sharedUserMatchWs = null;
          old.close(1000, "Component unmount");
        }
      }
      setConnectionState("disconnected");
    };
  }, [clearTimers]);

  // 전화·문자·SNS·앱 전환 후 복귀 시 죽은 소켓을 버리고 즉시 재연결 (웹·네이티브)
  useEffect(() => {
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = subscribeForegroundResume(() => {
      if (!isMountedRef.current) return;
      if (!matchIdRef.current || !userIdRef.current) return;
      if (
        shouldSkipForegroundWsResume({
          socketOpen: wsRef.current?.readyState === WebSocket.OPEN,
          lastOpenAtMs: lastOpenAtMs.current,
          nowMs: Date.now(),
        })
      ) {
        console.log("[WS] Foreground resume ignored — socket just opened");
        return;
      }

      console.log("[WS] Foreground resume, forcing reconnect");
      clearTimers();
      isIntentionalClose.current = true;
      if (wsRef.current) {
        const oldWs = wsRef.current;
        wsRef.current = null;
        oldWs.close(1000, "Foreground resume");
      }
      isIntentionalClose.current = false;
      reconnectAttempts.current = 0;

      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        resumeTimer = null;
        if (!isMountedRef.current) return;
        connectRef.current();
      }, 500);
    });

    return () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      unsubscribe();
    };
  }, [clearTimers]);

  // matchId, userId 변경 시 연결 관리 (cleanup 없이)
  useEffect(() => {
    console.log("[WS] Connection effect running", {
      isMounted: isMountedRef.current,
      matchId,
      userId: userId ? "***" : null,
      prevMatchId: prevMatchIdRef.current,
      autoConnect,
      wsState: wsRef.current?.readyState,
    });

    if (!isMountedRef.current) {
      console.log("[WS] Not mounted, skipping");
      return;
    }
    
    const matchIdChanged = prevMatchIdRef.current !== matchId;
    const userIdChanged = prevUserIdRef.current !== userId;
    const hasParams = matchId && userId;
    const hadParams = prevMatchIdRef.current && prevUserIdRef.current;

    // 파라미터가 없어졌으면 연결 종료
    if (hadParams && !hasParams) {
      console.log("[WS] Params cleared, disconnecting");
      isIntentionalClose.current = true;
      clearTimers();
      if (wsRef.current) {
        const oldWs = wsRef.current;
        wsRef.current = null;
        oldWs.close(1000, "Params cleared");
      }
      setConnectionState("disconnected");
      prevMatchIdRef.current = matchId;
      prevUserIdRef.current = userId;
      return;
    }

    // 연결해야 하는 상황
    if (autoConnect && hasParams) {
      // 이미 연결되어 있고 파라미터가 같으면 스킵
      if (wsRef.current?.readyState === WebSocket.OPEN && !matchIdChanged && !userIdChanged) {
        console.log("[WS] Already connected with same params, skipping");
        return;
      }
      
      // 이미 연결 중이면 스킵
      if (wsRef.current?.readyState === WebSocket.CONNECTING) {
        console.log("[WS] Already connecting, skipping");
        return;
      }

      // matchId나 userId가 변경되었으면 기존 연결 종료
      if ((matchIdChanged || userIdChanged) && wsRef.current) {
        console.log("[WS] Params changed, closing old connection", { matchIdChanged, userIdChanged });
        isIntentionalClose.current = true;
        clearTimers();
        const oldWs = wsRef.current;
        wsRef.current = null;
        oldWs.close(1000, "Params changed");
      }

      prevMatchIdRef.current = matchId;
      prevUserIdRef.current = userId;
      
      // 새 연결 시작
      console.log("[WS] Starting new connection");
      isIntentionalClose.current = false;
      connect();
    } else {
      console.log("[WS] Not connecting", { autoConnect, hasParams });
    }
  }, [matchId, userId, autoConnect, connect]);

  return {
    connectionState,
    isConnected: connectionState === "connected",
    connect,
    disconnect,
    reconnect,
  };
}
