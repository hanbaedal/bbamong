import {
  AD_INTRO_DELAY_MS,
  AD_PLAY_MS,
  AD_SCHEDULE_COOLDOWN_MS,
} from "@shared/adBreakTiming";
import { wsManager } from "./wsManager";

class BroadcastManager {
  private adDelayTimers: Map<string, NodeJS.Timeout> = new Map();
  private adPlayTimers: Map<string, NodeJS.Timeout> = new Map();
  private lastAdScheduledAt: Map<string, number> = new Map();

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

  /** 광고 중지. reason으로 회원 보상·화면 전이를 구분한다. */
  stopAdPlaying(
    matchId: string,
    reason: "prediction_start" | "operator_stop" | "round_advance",
    message: string,
  ) {
    this.clearAdTimer(matchId);
    this.setAdPlaying(matchId, false);
    this.sendToMatch(matchId, "ad_stopped", {
      matchId,
      message,
      reason,
    });
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

  /**
   * 수동·자동 공통: 쿨다운 내 재스케줄 거부.
   * 성공 시 안내 연출(AD_INTRO_DELAY_MS) 후 광고 시작, AD_PLAY_MS 후 자동 종료(보상).
   */
  tryScheduleAdBreak(
    matchId: string,
    options?: { rewardKey?: string; reason?: string; force?: boolean },
  ): boolean {
    const now = Date.now();
    const last = this.lastAdScheduledAt.get(matchId) ?? 0;
    if (!options?.force && now - last < AD_SCHEDULE_COOLDOWN_MS) {
      console.log(`[Ad] schedule skipped cooldown ${matchId}`);
      return false;
    }
    if (
      !options?.force &&
      (this.isAdPlaying(matchId) || this.adDelayTimers.has(matchId) || this.adPlayTimers.has(matchId))
    ) {
      console.log(`[Ad] schedule skipped already playing ${matchId}`);
      return false;
    }
    this.lastAdScheduledAt.set(matchId, now);
    if (options?.rewardKey) {
      this.sendToMatch(matchId, "rewarded_ad_offer", {
        matchId,
        rewardKey: options.rewardKey,
        points: 500,
        reason: options.reason,
      });
    }
    this.scheduleAdStart(matchId, AD_INTRO_DELAY_MS);
    return true;
  }

  scheduleAdStart(matchId: string, delayMs: number) {
    this.clearAdTimer(matchId);

    const startAd = () => {
      this.adDelayTimers.delete(matchId);
      this.setAdPlaying(matchId, true);
      const matchState = this.getMatchState(matchId);
      this.sendToMatch(matchId, "ad_started", {
        matchId,
        message: "광고가 시작되었습니다.",
        adStartedAt: matchState.adStartedAt,
      });
      // 광고 재생 고정 시간 후 자동 종료 (보상 가능 = operator_stop)
      const playTimer = setTimeout(() => {
        this.adPlayTimers.delete(matchId);
        if (this.isAdPlaying(matchId)) {
          this.stopAdPlaying(matchId, "operator_stop", "광고 시청이 완료되었습니다.");
        }
      }, AD_PLAY_MS);
      this.adPlayTimers.set(matchId, playTimer);
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
      clearTimeout(existing);
      this.adDelayTimers.delete(matchId);
    }
    const play = this.adPlayTimers.get(matchId);
    if (play) {
      clearTimeout(play);
      this.adPlayTimers.delete(matchId);
    }
  }
}

export const broadcastManager = new BroadcastManager();
