import { AD_BREAK_TOTAL_MS } from "@shared/adBreakTiming";
import { switchHalfAdBreakMessage } from "@shared/threeOutsGuard";
import { broadcastManager } from "./broadcastManager";

const lastSwitchAtByMatch = new Map<string, number>();

/** 안내 5초·재생 80초 동안 공수교대를 다시 받지 않는다. */
export function assertSwitchHalfNotDuringAd(matchId: string): void {
  if (broadcastManager.isAdBreakActive(matchId)) {
    throw new Error(switchHalfAdBreakMessage());
  }
}

export function markSwitchHalfDone(matchId: string, at = Date.now()): void {
  lastSwitchAtByMatch.set(matchId, at);
}

/** 방금 공수교대(광고 브레이크 또는 85초 쿨다운). 실황 3아웃 잔상으로 다시 열지 않음. */
export function wasSwitchHalfRecent(matchId: string, now = Date.now()): boolean {
  if (broadcastManager.isAdBreakActive(matchId)) return true;
  const at = lastSwitchAtByMatch.get(matchId) ?? 0;
  return at > 0 && now - at < AD_BREAK_TOTAL_MS;
}

export function resetSwitchHalfRecentForTest(matchId: string): void {
  lastSwitchAtByMatch.delete(matchId);
}
