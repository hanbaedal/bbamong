import { switchHalfAdBreakMessage } from "@shared/threeOutsGuard";
import { broadcastManager } from "./broadcastManager";

/** 안내 5초·재생 80초 동안 공수교대를 다시 받지 않는다. */
export function assertSwitchHalfNotDuringAd(matchId: string): void {
  if (broadcastManager.isAdBreakActive(matchId)) {
    throw new Error(switchHalfAdBreakMessage());
  }
}
