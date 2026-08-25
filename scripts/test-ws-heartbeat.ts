/**
 * Match WS keepalive 가드
 * 실행: npx tsx scripts/test-ws-heartbeat.ts
 */
import {
  WS_CLIENT_PONG_TIMEOUT_MS,
  WS_CONNECTION_REPLACED_CODE,
  inboundWsTrafficProvesAlive,
  isCurrentWsSocket,
  isWsConnectionReplacedCode,
  isWsKeepaliveReply,
  isWsNormalCloseCode,
  shouldCloseForPongTimeout,
  shouldRemoveMappedWsClient,
} from "../shared/wsHeartbeat";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(WS_CLIENT_PONG_TIMEOUT_MS >= 15_000, "pong timeout must outlast connected snapshot");
assert(WS_CONNECTION_REPLACED_CODE === 4010, "replaced code 4010");
assert(isWsKeepaliveReply("pong"), "pong reply");
assert(isWsKeepaliveReply("heartbeat_ack"), "heartbeat_ack reply");
assert(!isWsKeepaliveReply("connected"), "connected is not a ping reply");
assert(inboundWsTrafficProvesAlive("connected"), "connected proves alive");
assert(inboundWsTrafficProvesAlive("auto_result_timeout"), "staff event proves alive");
assert(inboundWsTrafficProvesAlive("pong"), "pong proves alive");
assert(!inboundWsTrafficProvesAlive(""), "empty type");
assert(!inboundWsTrafficProvesAlive(null), "null type");

assert(isWsConnectionReplacedCode(4010), "4010 replaced");
assert(!isWsConnectionReplacedCode(4000), "4000 heartbeat should reconnect");
assert(isWsNormalCloseCode(1000), "1000 normal");
assert(isWsNormalCloseCode(1001), "1001 going away");
assert(!isWsNormalCloseCode(1006), "1006 abnormal reconnect");

const sockA = { readyState: 1 };
const sockB = { readyState: 1 };
assert(isCurrentWsSocket(sockA, sockA), "same socket");
assert(!isCurrentWsSocket(sockB, sockA), "replaced socket");
assert(!isCurrentWsSocket(null, sockA), "null current");

assert(
  shouldCloseForPongTimeout({ pingSocket: sockA, currentSocket: sockA }),
  "current open socket may close on timeout",
);
assert(
  !shouldCloseForPongTimeout({ pingSocket: sockA, currentSocket: sockB }),
  "must not close ping socket after replacement",
);
const closed = { readyState: 3 };
assert(
  !shouldCloseForPongTimeout({ pingSocket: closed, currentSocket: closed }),
  "already closed",
);

const mapped = { id: "new" };
const closingOld = { id: "old" };
assert(shouldRemoveMappedWsClient(mapped, mapped), "remove matching ws");
assert(!shouldRemoveMappedWsClient(mapped, closingOld), "do not remove replacement");

console.log("OK: ws heartbeat guards");
