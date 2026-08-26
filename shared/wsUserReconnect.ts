/** 유저 경기 WS — 프록시가 4008을 1006으로 바꾸거나, 직후 foreground resume이 재연결을 도배하지 않게. */

export const WS_FOREGROUND_RESUME_GRACE_MS = 2_500;
export const WS_QUICK_CLOSE_MS = 1_500;
export const WS_QUICK_ABNORMAL_CLOSE_LIMIT = 3;
export const WS_NO_RECONNECT_CODES = [4002, 4006, 4007, 4008, 4010] as const;

export function isWsNoReconnectCode(code: number): boolean {
  return (WS_NO_RECONNECT_CODES as readonly number[]).includes(code);
}

export function shouldSkipForegroundWsResume(args: {
  socketOpen: boolean;
  lastOpenAtMs: number | null;
  nowMs: number;
}): boolean {
  if (!args.socketOpen || args.lastOpenAtMs == null) return false;
  return args.nowMs - args.lastOpenAtMs < WS_FOREGROUND_RESUME_GRACE_MS;
}

export function nextQuickAbnormalCloseCount(args: {
  closeCode: number;
  openedAtMs: number | null;
  closedAtMs: number;
  previousCount: number;
}): number {
  const abnormal = args.closeCode === 1006 || args.closeCode === 1005;
  if (!abnormal || args.openedAtMs == null) return 0;
  if (args.closedAtMs - args.openedAtMs > WS_QUICK_CLOSE_MS) return 0;
  return args.previousCount + 1;
}

export function shouldStopUserWsReconnect(args: {
  closeCode: number;
  sessionReplaced: boolean;
  consecutiveQuickAbnormalCloses: number;
}): boolean {
  if (isWsNoReconnectCode(args.closeCode)) return true;
  if (args.sessionReplaced && (args.closeCode === 1006 || args.closeCode === 1005)) {
    return true;
  }
  if (
    args.sessionReplaced &&
    args.consecutiveQuickAbnormalCloses >= WS_QUICK_ABNORMAL_CLOSE_LIMIT
  ) {
    return true;
  }
  return false;
}

/** TCP onopen만으로는 서버가 바로 닫는지 모른다. `connected` 수신 후에만 재시도 카운트를 리셋. */
export function shouldResetWsReconnectAttemptsOnOpen(): boolean {
  return false;
}
