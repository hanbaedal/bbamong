/**
 * Match WS keepalive — JSON ping/pong (프록시가 프로토콜 ping 프레임을 버려도 생존).
 * 운영자 콘솔이 onopen 직후 ping 후 10초 내 pong이 없으면 4000으로 끊기던 루프를 막는다.
 */

/** 클라 JSON ping 주기 */
export const WS_CLIENT_HEARTBEAT_INTERVAL_MS = 25_000;

/** 운영자 콘솔 — 프록시 idle 전에 데이터 프레임을 더 자주 보냄 */
export const WS_MANAGER_CLIENT_HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * JSON ping 이후 이 시간 안에 inbound 프레임이 없으면 재연결.
 * 10초는 서버가 connected 스냅샷(DB)을 보내는 동안 첫 ping이 유실되면 항상 타임아웃됐다.
 */
export const WS_CLIENT_PONG_TIMEOUT_MS = 20_000;

/** 서버 WebSocket 프로토콜 ping 주기 */
export const WS_SERVER_PROTOCOL_PING_MS = 30_000;

/**
 * 프로토콜 pong·JSON keepalive 둘 다 없으면 서버가 종료.
 * 45초는 핑 1회만 유실돼도(프록시가 프로토콜 ping을 버릴 때) terminate → 클라 1006이 났다.
 */
export const WS_SERVER_KEEPALIVE_STALE_MS = 90_000;

/** 서버 keepalive 만료 close — 프록시가 핸드셰이크를 버리면 클라는 1006으로 보일 수 있음 */
export const WS_KEEPALIVE_TIMEOUT_CODE = 4001;

/** 같은 역할·subject 재접속 시 기존 소켓에 보내는 close code */
export const WS_CONNECTION_REPLACED_CODE = 4010;

export function isWsKeepaliveReply(type: unknown): boolean {
  return type === "pong" || type === "heartbeat_ack";
}

/** inbound JSON 프레임이 있으면 소켓은 살아 있다 (connected, at_bat_phase, pong, …) */
export function inboundWsTrafficProvesAlive(type: unknown): boolean {
  return typeof type === "string" && type.length > 0;
}

export function isWsConnectionReplacedCode(code: number): boolean {
  return code === WS_CONNECTION_REPLACED_CODE;
}

export function isWsNormalCloseCode(code: number): boolean {
  return code === 1000 || code === 1001;
}

/** 교체된 소켓의 close/timeout은 새 연결 하트비트를 건드리지 않는다 */
export function isCurrentWsSocket<T>(current: T | null | undefined, eventSocket: T): boolean {
  return current === eventSocket;
}

/** pong 타임아웃으로 close 해도 되는 소켓인지 (교체·이미 닫힘 제외) */
export function shouldCloseForPongTimeout(opts: {
  pingSocket: { readyState: number };
  currentSocket: unknown;
  openReadyState?: number;
}): boolean {
  if (opts.currentSocket !== opts.pingSocket) return false;
  const open = opts.openReadyState ?? 1;
  return opts.pingSocket.readyState === open;
}

/** 맵에 있는 클라이언트가 지금 닫히는 소켓일 때만 제거 (재접속 레이스 방지) */
export function shouldRemoveMappedWsClient(mappedWs: unknown, closingWs: unknown): boolean {
  return mappedWs === closingWs;
}
