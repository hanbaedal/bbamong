/**
 * 운영자 경기종료 연출: 실황 FT 직후 비활성화/refresh 401로 화면이 끊기지 않게.
 * 실행: npx tsx scripts/test-operator-match-end.ts
 */
import {
  OPERATOR_MATCH_ENDED_LOGOUT_MS,
  OPERATOR_MATCH_ENDED_REVOKE_DELAY_MS,
  operatorAccountStatusFromPhase,
  resolveOperatorMatchPhase,
  shouldDeferOperatorDeactivation,
  shouldHoldOperatorSessionOnAuthError,
  shouldSkipOperatorWsReconnect,
} from "../shared/operatorMatchStatus";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(OPERATOR_MATCH_ENDED_LOGOUT_MS === 10_000, "operator overlay is 10s");
assert(
  OPERATOR_MATCH_ENDED_REVOKE_DELAY_MS > OPERATOR_MATCH_ENDED_LOGOUT_MS,
  "revoke waits until overlay finishes",
);

assert(shouldDeferOperatorDeactivation("경기종료") === true, "defer deactivation on 경기종료");
assert(shouldDeferOperatorDeactivation("경기중") === false, "live match still syncs account");
assert(shouldDeferOperatorDeactivation("경기전") === false, "pregame still syncs account");
assert(shouldDeferOperatorDeactivation("연기됨") === false, "postponed still deactivates");
assert(shouldDeferOperatorDeactivation(null) === false, "null phase does not defer");

assert(
  resolveOperatorMatchPhase({ matchStatus: "completed" }) === "경기종료",
  "completed → 경기종료",
);
assert(
  shouldDeferOperatorDeactivation(resolveOperatorMatchPhase({ matchStatus: "completed" })) === true,
  "completed match defers operator deactivation",
);
assert(
  operatorAccountStatusFromPhase("경기종료") === "비활성화",
  "revoke still marks 비활성화 after overlay",
);

assert(
  shouldHoldOperatorSessionOnAuthError({ matchEnded: true, overlayStarted: false }) === true,
  "matchEnded 401/403 starts overlay instead of wiping tokens",
);
assert(
  shouldHoldOperatorSessionOnAuthError({ matchEnded: false, overlayStarted: true }) === true,
  "already in overlay keeps tokens on later 401",
);
assert(
  shouldHoldOperatorSessionOnAuthError({ matchEnded: false, overlayStarted: false }) === false,
  "plain session expiry still logs out",
);

assert(
  shouldSkipOperatorWsReconnect({
    overlayStarted: true,
    sessionExpired: false,
    duplicateLogin: false,
    unmounting: false,
  }) === true,
  "overlay skips WS reconnect (no 1006 loop / 4005 session-expired)",
);
assert(
  shouldSkipOperatorWsReconnect({
    overlayStarted: false,
    sessionExpired: false,
    duplicateLogin: false,
    unmounting: false,
  }) === false,
  "live operator still reconnects",
);
assert(
  shouldSkipOperatorWsReconnect({
    overlayStarted: false,
    sessionExpired: true,
    duplicateLogin: false,
    unmounting: false,
  }) === true,
  "expired session does not reconnect",
);

console.log("OK: operator match-end overlay holds session until 10s logout, revoke at 12s");
