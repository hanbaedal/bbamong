import { wsManager } from "./wsManager";
import { agentDebugLog } from "../agentDebugLog";

class BroadcastManager {
  private adDelayTimers: Map<string, NodeJS.Timeout> = new Map();

  sendToMatch(matchId: string, eventType: string, data: any) {
    wsManager.sendToMatch(matchId, eventType, data);
  }

  sendToMatchWithUserData(matchId: string, eventType: string, baseData: any, userDataMap: Map<string, any>) {
    wsManager.sendToMatchWithUserData(matchId, eventType, baseData, userDataMap);
  }

  broadcastToAll(eventType: string, data: any) {
    wsManager.broadcastToAll(eventType, data);
  }

  setAdPlaying(matchId: string, isPlaying: boolean) {
    wsManager.setAdPlaying(matchId, isPlaying);
  }

  isAdPlaying(matchId: string): boolean {
    return wsManager.isAdPlaying(matchId);
  }

  getMatchState(matchId: string) {
    return wsManager.getMatchState(matchId);
  }

  getClientCount(matchId: string): number {
    return wsManager.getClientCount(matchId);
  }

  hasClients(matchId: string): boolean {
    return wsManager.hasClients(matchId);
  }

  scheduleAdStart(matchId: string, delayMs: number) {
    // #region agent log
    agentDebugLog({
      hypothesisId: "E",
      location: "broadcastManager.ts:scheduleAdStart",
      message: "scheduleAdStart called",
      data: {
        matchId,
        delayMs,
        hadExistingTimer: this.adDelayTimers.has(matchId),
        clientCount: this.getClientCount(matchId),
      },
    });
    // #endregion
    this.clearAdTimer(matchId);
    
    const startAd = () => {
      this.adDelayTimers.delete(matchId);
      this.setAdPlaying(matchId, true);
      const matchState = this.getMatchState(matchId);
      // #region agent log
      agentDebugLog({
        hypothesisId: "A",
        location: "broadcastManager.ts:startAd",
        message: "ad_started sending",
        data: {
          matchId,
          adStartedAt: matchState.adStartedAt,
          clientCount: this.getClientCount(matchId),
          delayMs,
        },
      });
      // #endregion
      this.sendToMatch(matchId, "ad_started", {
        matchId,
        message: "광고가 시작되었습니다.",
        adStartedAt: matchState.adStartedAt,
      });
    };

    if (delayMs === 0) {
      startAd();
    } else {
      const timer = setTimeout(startAd, delayMs);
      this.adDelayTimers.set(matchId, timer);
    }
  }

  clearAdTimer(matchId: string) {
    const existing = this.adDelayTimers.get(matchId);
    if (existing) {
      // #region agent log
      agentDebugLog({
        hypothesisId: "E",
        location: "broadcastManager.ts:clearAdTimer",
        message: "clearAdTimer cancelled pending timer",
        data: { matchId },
      });
      // #endregion
      clearTimeout(existing);
      this.adDelayTimers.delete(matchId);
    }
  }
}

export const broadcastManager = new BroadcastManager();
