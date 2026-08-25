/**
 * 실황 자동 WS 이벤트 — 회원 클라 미전송 / 운영자만
 * 실행: npx tsx scripts/test-live-auto-ws-events.ts
 */
import {
  isLiveAutoOperatorWsType,
  LIVE_AUTO_OPERATOR_WS_TYPES,
  LIVE_AUTO_STAFF_WS_ROLES,
} from "../shared/liveAutoWsEvents";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(LIVE_AUTO_OPERATOR_WS_TYPES.includes("auto_result_suggested"), "suggested listed");
assert(isLiveAutoOperatorWsType("auto_result_suggested"), "suggested is operator type");
assert(isLiveAutoOperatorWsType("auto_action_blocked"), "blocked is operator type");
assert(isLiveAutoOperatorWsType("auto_action_suggested"), "action suggested");
assert(isLiveAutoOperatorWsType("auto_result_timeout"), "timeout");
assert(isLiveAutoOperatorWsType("auto_pinch_suggested"), "pinch");
assert(!isLiveAutoOperatorWsType("round_result"), "round_result is for users");
assert(!isLiveAutoOperatorWsType("prediction_started"), "prediction_started is for users");
assert(!isLiveAutoOperatorWsType("at_bat_phase"), "at_bat_phase is for users");
assert(LIVE_AUTO_STAFF_WS_ROLES.includes("manager"), "manager role");
assert(LIVE_AUTO_STAFF_WS_ROLES.includes("admin"), "admin role");
assert(!(LIVE_AUTO_STAFF_WS_ROLES as readonly string[]).includes("user"), "user not staff");

console.log("OK: live-auto operator WS types");
