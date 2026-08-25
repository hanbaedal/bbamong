import {
  AD_INTRO_DELAY_MS,
  AD_SCHEDULE_COOLDOWN_MS,
  adRemainingMs,
  isAdPlayExpired,
} from "@shared/adBreakTiming";
import { LIVE_AUTO_STAFF_WS_ROLES } from "@shared/liveAutoWsEvents";
import { wsManager } from "./wsManager";

type AdStopReason = "prediction_start" | "operator_stop" | "round_advance";
type AdStopListener = (matchId: string, reason: AdStopReason) => void;

class BroadcastManager {
  private adDelayTimers: Map<string, NodeJS.Timeout> = new Map();
  private adPlayTimers: Map<string, NodeJS.Timeout> = new Map();
  private lastAdScheduledAt: Map<string, number> = new Map();
  private adStopListeners: AdStopListener[] = [];
  private adWatchdog: NodeJS.Timeout | null = null;

  sendToMatch(matchId: string, eventType: string, data: any) {
    wsManager.sendToMatch(matchId, eventType, data);
  }

  /** 운영자·관리자만 — 회원 예측 클라에 auto_* 안내를 보내지 않는다 */
  sendToMatchStaff(matchId: string, eventType: string, data: any) {
    wsManager.sendToMatch(matchId, eventType, data, { roles: LIVE_AUTO_STAFF_WS_ROLES });
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

  onAdStopped(listener: AdStopListener): void {
    this.adStopListeners.push(listener);
  }

  /** 안내 지연·재생 타이머 또는 재생 플래그가 있으면 브레이크 중 */
  isAdBreakActive(matchId: string): boolean {
    return (
      this.isAdPlaying(matchId) ||
      this.adDelayTimers.has(matchId) ||
      this.adPlayTimers.has(matchId)
    );
  }

  /** 광고 중지. reason으로 회원 보상·화면 전이를 구분한다. */
  stopAdPlaying(
    matchId: string,
    reason: AdStopReason,
    message: string,
  ) {
    this.clearAdTimer(matchId);
    this.setAdPlaying(matchId, false);
    this.sendToMatch(matchId, "ad_stopped", {
      matchId,
      message,
      reason,
    });
    for (const listener of this.adStopListeners) {
      try {
        listener(matchId, reason);
      } catch (error) {
        console.warn("[Ad] stop listener failed", error);
      }
    }
  }

  /** AD_PLAY_MS가 지난 광고를 타이머 유실과 관계없이 종료한다. */
  enforceAdDeadlines(matchId?: string): void {
    const ids = matchId ? [matchId] : wsManager.getMatchIdsWithAds();
    for (const id of ids) {
      const state = this.getMatchState(id);
      if (!state.isAdPlaying) continue;
      if (!isAdPlayExpired(state.adStartedAt)) continue;
      console.log(`[Ad] watchdog stop ${id} startedAt=${state.adStartedAt}`);
      this.stopAdPlaying(id, "operator_stop", "광고 시청이 완료되었습니다.");
    }
  }

  startAdWatchdog(): void {
    if (this.adWatchdog) return;
    this.adWatchdog = setInterval(() => this.enforceAdDeadlines(), 2_000);
    this.adWatchdog.unref();
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
    this.startAdWatchdog();
    return true;
  }

  scheduleAdStart(matchId: string, delayMs: number) {
    this.clearAdTimer(matchId);

    const armPlayTimer = () => {
      const matchState = this.getMatchState(matchId);
      const remaining = adRemainingMs(matchState.adStartedAt);
      const playTimer = setTimeout(() => {
        this.adPlayTimers.delete(matchId);
        if (this.isAdPlaying(matchId)) {
          this.stopAdPlaying(matchId, "operator_stop", "광고 시청이 완료되었습니다.");
        }
      }, Math.max(250, remaining));
      this.adPlayTimers.set(matchId, playTimer);
    };

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
      armPlayTimer();
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

  /** 테스트 — 광고 타이머·쿨다운을 지워 다음 시나리오가 독립되게 한다 */
  resetAdBreakForTest(matchId: string) {
    this.clearAdTimer(matchId);
    this.setAdPlaying(matchId, false);
    this.lastAdScheduledAt.delete(matchId);
  }
}

export const broadcastManager = new BroadcastManager();
