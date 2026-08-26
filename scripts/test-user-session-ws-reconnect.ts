/**
 * 유저 세션 오탐(Redis 없음 = 다른 기기)과 WS 1006 재연결 가드
 * 실행: npx tsx scripts/test-user-session-ws-reconnect.ts
 */
import { interpretUserSession } from "../shared/userSessionVerdict";
import {
  nextQuickAbnormalCloseCount,
  shouldResetWsReconnectAttemptsOnOpen,
  shouldSkipForegroundWsResume,
  shouldStopUserWsReconnect,
  WS_FOREGROUND_RESUME_GRACE_MS,
  WS_QUICK_ABNORMAL_CLOSE_LIMIT,
} from "../shared/wsUserReconnect";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(interpretUserSession("abc", "abc") === "ok", "matching session is ok");
assert(interpretUserSession("other", "abc") === "replaced", "mismatch is replaced");
assert(interpretUserSession(null, "abc") === "missing", "empty redis is missing not replaced");
assert(interpretUserSession(undefined, "abc") === "missing", "undefined redis is missing");
assert(interpretUserSession("abc", undefined) === "legacy", "jwt without sessionId is legacy");
assert(interpretUserSession(null, undefined) === "legacy", "no jwt sessionId is legacy not replaced");

assert(shouldResetWsReconnectAttemptsOnOpen() === false, "do not reset attempts on TCP open");

assert(
  shouldSkipForegroundWsResume({
    socketOpen: true,
    lastOpenAtMs: 1000,
    nowMs: 1000 + WS_FOREGROUND_RESUME_GRACE_MS - 1,
  }),
  "skip resume right after open",
);
assert(
  !shouldSkipForegroundWsResume({
    socketOpen: true,
    lastOpenAtMs: 1000,
    nowMs: 1000 + WS_FOREGROUND_RESUME_GRACE_MS + 1,
  }),
  "allow resume after grace",
);
assert(
  !shouldSkipForegroundWsResume({
    socketOpen: false,
    lastOpenAtMs: 1000,
    nowMs: 1100,
  }),
  "do not skip resume when socket is down",
);

assert(
  shouldStopUserWsReconnect({
    closeCode: 4008,
    sessionReplaced: false,
    consecutiveQuickAbnormalCloses: 0,
  }),
  "4008 never reconnects",
);
assert(
  shouldStopUserWsReconnect({
    closeCode: 1006,
    sessionReplaced: true,
    consecutiveQuickAbnormalCloses: 1,
  }),
  "proxy-stripped 4008 (1006) stops when session replaced",
);
assert(
  !shouldStopUserWsReconnect({
    closeCode: 1006,
    sessionReplaced: false,
    consecutiveQuickAbnormalCloses: 1,
  }),
  "transient 1006 still reconnects",
);

const firstQuick = nextQuickAbnormalCloseCount({
  closeCode: 1006,
  openedAtMs: 0,
  closedAtMs: 200,
  previousCount: 0,
});
assert(firstQuick === 1, "quick 1006 increments");
const secondQuick = nextQuickAbnormalCloseCount({
  closeCode: 1006,
  openedAtMs: 0,
  closedAtMs: 200,
  previousCount: firstQuick,
});
assert(secondQuick === 2, "second quick 1006 increments");
const slowReset = nextQuickAbnormalCloseCount({
  closeCode: 1006,
  openedAtMs: 0,
  closedAtMs: 5000,
  previousCount: secondQuick,
});
assert(slowReset === 0, "slow 1006 resets the streak");
assert(WS_QUICK_ABNORMAL_CLOSE_LIMIT === 3, "force-refresh after 3 immediate 1006");

console.log("OK: user session missing≠replaced and WS reconnect guards");
