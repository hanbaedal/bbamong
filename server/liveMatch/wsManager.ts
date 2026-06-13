import { WebSocket, WebSocketServer } from "ws";
import { IncomingMessage } from "http";
import { verifyUserAccessToken, verifyAccessToken } from "../utils/jwt";
import { parse as parseCookie } from "cookie";
import { getMatchInfo } from "./predictionStorage";
import { createSession, hasActiveSession, refreshSession } from "../sessionManager";
import type { UserType } from "../sessionValidator";

interface WSClient {
  clientId: string;
  role: string;
  subjectId: string;
  ws: WebSocket;
  matchId: string;
  lastPong: number;
  isAlive: boolean;
}

interface MatchState {
  isAdPlaying: boolean;
  adStartedAt: number | null;
}

class WSManager {
  private clients: Map<string, WSClient[]> = new Map();
  private matchStates: Map<string, MatchState> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private wss: WebSocketServer | null = null;

  initialize(wss: WebSocketServer) {
    if (this.wss) {
      console.log("[WS] Already initialized, cleaning up previous instance");
      this.cleanup();
    }
    
    this.wss = wss;
    this.startPingInterval();

    wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
      const url = new URL(req.url || "", `ws://${req.headers.host}`);
      const matchId = url.searchParams.get("matchId");
      const token = url.searchParams.get("token");

      if (!matchId) {
        console.log("[WS] Missing matchId");
        ws.close(4001, "Missing matchId");
        return;
      }

      try {
        let role = "user";
        let subjectId = "";
        let authenticated = false;

        // First try cookie-based authentication (for admin/manager)
        if (req.headers.cookie) {
          const cookies = parseCookie(req.headers.cookie);
          const adminAccessToken = cookies.adminAccessToken;
          const managerAccessToken = cookies.managerAccessToken;
          
          // Try admin token first
          if (adminAccessToken) {
            try {
              const decoded = verifyAccessToken(adminAccessToken);
              if (decoded.approvalStatus === "승인") {
                role = decoded.userType === "매니저" ? "manager" : "admin";
                subjectId = decoded.adminId;
                authenticated = true;
                console.log(`[WS] Authenticated via adminAccessToken cookie: ${role}:${subjectId}`);
              } else {
                console.log(`[WS] Admin cookie token valid but approvalStatus is "${decoded.approvalStatus}", not "승인"`);
              }
            } catch (e: any) {
              console.log(`[WS] Admin cookie token verification failed: ${e.message}`);
            }
          }
          
          // Try manager token if admin auth failed
          if (!authenticated && managerAccessToken) {
            try {
              const decoded = verifyAccessToken(managerAccessToken);
              if (decoded.approvalStatus === "승인") {
                role = "manager";
                subjectId = decoded.adminId;
                authenticated = true;
                console.log(`[WS] Authenticated via managerAccessToken cookie: ${role}:${subjectId}`);
              } else {
                console.log(`[WS] Manager cookie token valid but approvalStatus is "${decoded.approvalStatus}", not "승인"`);
              }
            } catch (e: any) {
              console.log(`[WS] Manager cookie token verification failed: ${e.message}`);
            }
          }
          
          if (!authenticated) {
            console.log("[WS] No valid token in cookies, available cookies:", Object.keys(cookies).join(", "));
          }
        } else {
          console.log("[WS] No cookies in request headers");
        }

        // Fall back to query param token (for users and backward compatibility)
        if (!authenticated && token) {
          try {
            const decoded = verifyUserAccessToken(token);
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (decoded.userId && typeof decoded.userId === "string" && uuidRegex.test(decoded.userId)) {
              role = "user";
              subjectId = decoded.userId;
              authenticated = true;
            } else {
              throw new Error("Invalid userId in token");
            }
          } catch {
            try {
              const decoded = verifyAccessToken(token);
              const adminUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
              if (decoded.adminId && typeof decoded.adminId === "string" && adminUuidRegex.test(decoded.adminId)) {
                role = decoded.userType === "매니저" ? "manager" : "admin";
                subjectId = decoded.adminId;
                authenticated = true;
              } else {
                console.log("[WS] Token valid but missing adminId");
              }
            } catch {
              console.log("[WS] Query param token verification failed");
            }
          }
        }

        if (!authenticated) {
          console.log("[WS] Authentication failed - no valid token");
          ws.close(4002, "Invalid token");
          return;
        }

        this.addClient(matchId, role, subjectId, ws);

        // WS 연결 시 Redis 세션 확인/갱신 (매니저, 유저 모두)
        this.ensureSession(role, subjectId).catch((err) => {
          console.error(`[WS] 세션 갱신 실패 (${role}:${subjectId}):`, err);
        });

        // 현재 경기 상태 조회
        let predictionEnabled = false;
        let currentRound = 1;
        try {
          const matchInfo = await getMatchInfo(matchId);
          if (matchInfo) {
            predictionEnabled = matchInfo.predictionEnabled;
            currentRound = matchInfo.currentRound;
          }
        } catch (e) {
          console.error("[WS] Error fetching match info:", e);
        }

        ws.send(JSON.stringify({
          type: "connected",
          data: {
            message: "연결되었습니다.",
            role,
            clientId: `${role}:${subjectId}`,
            matchId,
            predictionEnabled,
            currentRound,
          },
        }));

        // 유저인 경우 현재 라운드에 이미 예측했는지 확인
        if (role === "user" && subjectId) {
          try {
            const { getUserPredictionByMatchRound } = await import("./predictionStorage");
            const existingPrediction = await getUserPredictionByMatchRound(subjectId, matchId, currentRound);
            if (existingPrediction && (existingPrediction.status === 'pending' || existingPrediction.status === 'success' || existingPrediction.status === 'fail')) {
              ws.send(JSON.stringify({
                type: "user_already_predicted",
                data: {
                  prediction: existingPrediction.prediction,
                  predictionId: existingPrediction.id,
                  round: existingPrediction.roundNumber,
                  status: existingPrediction.status,
                  wonAmount: existingPrediction.wonAmount ?? 0,
                  amount: existingPrediction.amount ?? 0,
                },
              }));
            } else if (!existingPrediction) {
              // 현재 라운드에 예측이 없는 경우 — 바로 직전 라운드(currentRound-1)이고
              // 아직 새 예측이 시작되지 않은 상황일 때만 이전 결과 복원 (앱 재시작 시)
              const { getLatestResolvedPredictionForMatch } = await import("./predictionStorage");
              const resolvedPrediction = await getLatestResolvedPredictionForMatch(subjectId, matchId);
              if (
                resolvedPrediction &&
                resolvedPrediction.roundNumber === currentRound - 1 &&
                !predictionEnabled
              ) {
                ws.send(JSON.stringify({
                  type: "user_already_predicted",
                  data: {
                    prediction: resolvedPrediction.prediction,
                    predictionId: resolvedPrediction.id,
                    round: resolvedPrediction.roundNumber,
                    status: resolvedPrediction.status,
                    wonAmount: resolvedPrediction.wonAmount ?? 0,
                    amount: resolvedPrediction.amount ?? 0,
                    fromPreviousRound: true,
                  },
                }));
              }
            }
          } catch (e) {
            console.error("[WS] Error checking user prediction:", e);
          }
        }

        const matchState = this.getMatchState(matchId);
        if (matchState.isAdPlaying) {
          ws.send(JSON.stringify({
            type: "ad_status",
            data: { isAdPlaying: true, adStartedAt: matchState.adStartedAt },
          }));
        }

        ws.on("message", (message: Buffer) => {
          try {
            const data = JSON.parse(message.toString());
            this.handleMessage(matchId, `${role}:${subjectId}`, data, ws);
          } catch (error) {
            console.error("[WS] Error parsing message:", error);
          }
        });

        ws.on("pong", () => {
          const client = this.findClient(matchId, `${role}:${subjectId}`);
          if (client) {
            client.lastPong = Date.now();
            client.isAlive = true;
          }
          this.throttledSessionRefresh(role, subjectId);
        });

        ws.on("close", () => {
          this.removeClient(matchId, `${role}:${subjectId}`);
        });

        ws.on("error", (error) => {
          console.error(`[WS] Error for client ${role}:${subjectId}:`, error);
          this.removeClient(matchId, `${role}:${subjectId}`);
        });

      } catch (error) {
        console.error("[WS] Connection error:", error);
        ws.close(4003, "Authentication failed");
      }
    });

    console.log("[WS] WebSocket manager initialized");
  }

  private startPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(() => {
      const now = Date.now();
      
      this.clients.forEach((clients, matchId) => {
        for (let i = clients.length - 1; i >= 0; i--) {
          const client = clients[i];
          if (!client.isAlive) {
            console.log(`[WS] Client ${client.clientId} timed out, closing connection`);
            client.ws.terminate();
            clients.splice(i, 1);
            continue;
          }

          if (now - client.lastPong > 45000) {
            client.isAlive = false;
          }

          try {
            client.ws.ping();
          } catch (error) {
            console.error(`[WS] Error pinging client ${client.clientId}:`, error);
          }
        }

        if (clients.length === 0) {
          this.clients.delete(matchId);
        }
      });
    }, 30000);
  }

  private async ensureSession(role: string, subjectId: string): Promise<void> {
    const sessionRole = role as UserType;
    if (sessionRole !== "manager" && sessionRole !== "user") return;

    const exists = await hasActiveSession(sessionRole, subjectId);
    if (exists) {
      await refreshSession(sessionRole, subjectId);
    } else {
      await createSession(sessionRole, subjectId, {
        restoredByWs: true,
      });
      console.log(`[WS] Redis 세션 복구 (${role}:${subjectId})`);
    }
  }

  private sessionRefreshTimestamps: Map<string, number> = new Map();

  private throttledSessionRefresh(role: string, subjectId: string): void {
    const key = `${role}:${subjectId}`;
    const now = Date.now();
    const last = this.sessionRefreshTimestamps.get(key) || 0;
    if (now - last < 60000) return;
    this.sessionRefreshTimestamps.set(key, now);
    this.ensureSession(role, subjectId).catch((err) => {
      console.error(`[WS] 세션 갱신 실패 (${key}):`, err);
    });
  }

  private handleMessage(matchId: string, clientId: string, data: any, ws: WebSocket) {
    switch (data.type) {
      case "ping":
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        break;
      case "heartbeat":
        ws.send(JSON.stringify({ type: "heartbeat_ack", timestamp: Date.now() }));
        break;
      default:
        console.log(`[WS] Unknown message type from ${clientId}:`, data.type);
    }
  }

  private findClient(matchId: string, clientId: string): WSClient | undefined {
    const clients = this.clients.get(matchId);
    return clients?.find(c => c.clientId === clientId);
  }

  addClient(matchId: string, role: string, subjectId: string, ws: WebSocket) {
    if (!this.clients.has(matchId)) {
      this.clients.set(matchId, []);
    }

    const clientId = `${role}:${subjectId}`;
    const clients = this.clients.get(matchId)!;

    const existingIndex = clients.findIndex(c => c.clientId === clientId);
    if (existingIndex !== -1) {
      console.log(`[WS] Replacing existing connection for ${clientId} on match ${matchId}`);
      try {
        clients[existingIndex].ws.close(4010, "Connection replaced by reconnect");
      } catch (error) {
        console.error(`Error closing old connection for ${clientId}:`, error);
      }
      clients.splice(existingIndex, 1);
    }

    const newClient: WSClient = {
      clientId,
      role,
      subjectId,
      ws,
      matchId,
      lastPong: Date.now(),
      isAlive: true,
    };
    clients.push(newClient);

    console.log(`[WS] Client ${clientId} connected to match ${matchId}. Total clients: ${clients.length}`);
  }

  removeClient(matchId: string, clientId: string) {
    const clients = this.clients.get(matchId);
    if (!clients) return;

    const index = clients.findIndex(client => client.clientId === clientId);
    if (index !== -1) {
      const client = clients[index];
      if (client.role === "user") {
        this.trackUserDisconnect(client.subjectId);
      }
      clients.splice(index, 1);
      console.log(`[WS] Client ${clientId} disconnected from match ${matchId}. Remaining clients: ${clients.length}`);
    }

    if (clients.length === 0) {
      this.clients.delete(matchId);
      console.log(`[WS] No more clients for match ${matchId}. Channel closed.`);
    }
  }

  sendToMatch(matchId: string, eventType: string, data: any) {
    const clients = this.clients.get(matchId);
    if (!clients || clients.length === 0) {
      console.log(`[WS] ⚠️ No clients connected to match ${matchId} for event ${eventType}`);
      console.log(`[WS] Available matches with clients: ${Array.from(this.clients.keys()).join(', ') || 'none'}`);
      return;
    }

    const userCount = clients.filter(c => c.role === "user").length;
    const managerCount = clients.filter(c => c.role === "manager").length;
    const adminCount = clients.filter(c => c.role === "admin").length;
    console.log(`[WS] Sending ${eventType} to ${clients.length} clients for match ${matchId} (users: ${userCount}, managers: ${managerCount}, admins: ${adminCount})`);

    const message = JSON.stringify({ type: eventType, data });
    let sentCount = 0;
    let failedCount = 0;
    
    clients.forEach(client => {
      try {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(message);
          sentCount++;
          console.log(`[WS] Sent ${eventType} to ${client.clientId}`);
        } else {
          console.log(`[WS] Client ${client.clientId} not OPEN (state: ${client.ws.readyState})`);
          failedCount++;
        }
      } catch (error) {
        console.error(`[WS] Error sending to client ${client.clientId}:`, error);
        failedCount++;
      }
    });
    
    console.log(`[WS] ${eventType} sent to ${sentCount} clients, failed: ${failedCount}`);
  }

  sendToMatchWithUserData(matchId: string, eventType: string, baseData: any, userDataMap: Map<string, any>) {
    const clients = this.clients.get(matchId);
    if (!clients || clients.length === 0) return;

    console.log(`[WS] Sending personalized ${eventType} to ${clients.length} clients for match ${matchId}`);

    let sentCount = 0;
    let failedCount = 0;

    clients.forEach(client => {
      try {
        if (client.ws.readyState === WebSocket.OPEN) {
          const userData = client.role === "user" ? userDataMap.get(client.subjectId) : undefined;
          const personalizedData = userData ? { ...baseData, ...userData } : baseData;
          const message = JSON.stringify({ type: eventType, data: personalizedData });
          client.ws.send(message);
          sentCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        console.error(`[WS] Error sending personalized ${eventType} to ${client.clientId}:`, error);
        failedCount++;
      }
    });

    console.log(`[WS] Personalized ${eventType} sent to ${sentCount} clients, failed: ${failedCount}`);
  }

  broadcastToAll(eventType: string, data: any) {
    let totalClients = 0;
    const message = JSON.stringify({ type: eventType, data });

    this.clients.forEach((clients) => {
      clients.forEach(client => {
        try {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(message);
            totalClients++;
          }
        } catch (error) {
          console.error(`[WS] Error broadcasting to client ${client.clientId}:`, error);
        }
      });
    });

    console.log(`[WS] Broadcasted ${eventType} to ${totalClients} clients across all matches`);
  }

  getClientCount(matchId: string): number {
    return this.clients.get(matchId)?.length || 0;
  }

  hasClients(matchId: string): boolean {
    return this.getClientCount(matchId) > 0;
  }

  setAdPlaying(matchId: string, isPlaying: boolean) {
    if (!this.matchStates.has(matchId)) {
      this.matchStates.set(matchId, { isAdPlaying: false, adStartedAt: null });
    }
    const state = this.matchStates.get(matchId)!;
    state.isAdPlaying = isPlaying;
    state.adStartedAt = isPlaying ? Date.now() : null;
  }

  isAdPlaying(matchId: string): boolean {
    return this.matchStates.get(matchId)?.isAdPlaying || false;
  }

  getMatchState(matchId: string): MatchState {
    if (!this.matchStates.has(matchId)) {
      this.matchStates.set(matchId, { isAdPlaying: false, adStartedAt: null });
    }
    return this.matchStates.get(matchId)!;
  }

  private recentlyDisconnectedUsers: Map<string, number> = new Map();
  private readonly DISCONNECT_GRACE_PERIOD = 5 * 60 * 1000;

  getConnectedUserIds(): Set<string> {
    const userIds = new Set<string>();
    this.clients.forEach((clients) => {
      for (const client of clients) {
        if (client.role === "user") {
          userIds.add(client.subjectId);
        }
      }
    });
    return userIds;
  }

  getRecentlyActiveUserIds(): Set<string> {
    const userIds = this.getConnectedUserIds();
    const now = Date.now();
    this.recentlyDisconnectedUsers.forEach((disconnectTime, userId) => {
      if (now - disconnectTime < this.DISCONNECT_GRACE_PERIOD) {
        userIds.add(userId);
      } else {
        this.recentlyDisconnectedUsers.delete(userId);
      }
    });
    return userIds;
  }

  trackUserDisconnect(subjectId: string): void {
    this.recentlyDisconnectedUsers.set(subjectId, Date.now());
  }

  /**
   * 특정 역할/사용자의 모든 WebSocket 연결 강제 종료
   * 세션 삭제 시 호출하여 기존 WebSocket 연결 정리
   */
  forceDisconnectBySubjectId(role: string, subjectId: string): number {
    const clientId = `${role}:${subjectId}`;
    let disconnectedCount = 0;

    this.clients.forEach((clients, matchId) => {
      const clientIndex = clients.findIndex(c => c.clientId === clientId);
      if (clientIndex !== -1) {
        const client = clients[clientIndex];
        try {
          client.ws.close(4005, "Session terminated");
          console.log(`[WS] Force disconnected ${clientId} from match ${matchId}`);
          disconnectedCount++;
        } catch (error) {
          console.error(`[WS] Error force disconnecting ${clientId}:`, error);
        }
        clients.splice(clientIndex, 1);

        if (clients.length === 0) {
          this.clients.delete(matchId);
        }
      }
    });

    if (disconnectedCount > 0) {
      console.log(`[WS] Force disconnected ${disconnectedCount} connection(s) for ${clientId}`);
    }

    return disconnectedCount;
  }

  cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    this.clients.forEach((clients) => {
      clients.forEach(client => {
        try {
          client.ws.close(1000, "Server shutting down");
        } catch (error) {
          console.error("[WS] Error closing client on cleanup:", error);
        }
      });
    });

    this.clients.clear();
    this.matchStates.clear();

    if (this.wss) {
      try {
        this.wss.close();
      } catch (error) {
        console.error("[WS] Error closing WebSocket server:", error);
      }
      this.wss = null;
    }

    console.log("[WS] WSManager cleaned up");
  }
}

export const wsManager = new WSManager();
