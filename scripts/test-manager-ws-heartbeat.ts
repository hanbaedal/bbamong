/**
 * 운영자/관리자 Match WS: onopen 즉시 JSON ping → pong, 12초 유지, 재접속 시 4010 + 새 소켓 생존
 * 실행: npx tsx scripts/test-manager-ws-heartbeat.ts
 * 서버(http://127.0.0.1:5000)가 떠 있어야 한다.
 */
import "dotenv/config";
import WebSocket from "ws";
import { randomUUID } from "crypto";

const BASE = process.env.WS_HEARTBEAT_TEST_BASE || "http://127.0.0.1:5000";
const USER = process.env.WS_HEARTBEAT_TEST_USER || "ppamong";
const PASS = process.env.WS_HEARTBEAT_TEST_PASS || "ppamong.0323";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function cookieHeader(setCookie: string[] | undefined): string {
  if (!setCookie?.length) return "";
  return setCookie
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

function onceMessage(ws: WebSocket, timeoutMs: number): Promise<{ type?: string }> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`message timeout ${timeoutMs}ms`)), timeoutMs);
    ws.once("message", (raw) => {
      clearTimeout(t);
      try {
        resolve(JSON.parse(raw.toString()));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function waitType(
  ws: WebSocket,
  type: string,
  timeoutMs: number,
): Promise<{ type?: string; data?: unknown }> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`wait ${type} timeout ${timeoutMs}ms`)), timeoutMs);
    const onMsg = (raw: WebSocket.RawData) => {
      try {
        const parsed = JSON.parse(raw.toString()) as { type?: string; data?: unknown };
        if (parsed.type === type) {
          clearTimeout(t);
          ws.off("message", onMsg);
          resolve(parsed);
        }
      } catch {
        /* ignore non-json */
      }
    };
    ws.on("message", onMsg);
  });
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: USER, password: PASS }),
  });
  assert(res.ok, `login ${res.status} ${await res.text()}`);
  const header = cookieHeader(res.headers.getSetCookie?.() ?? undefined);
  assert(header.includes("adminAccessToken"), "adminAccessToken cookie");
  return header;
}

function connect(matchId: string, cookie: string): WebSocket {
  const url = `${BASE.replace("http", "ws")}/ws/match?matchId=${matchId}`;
  return new WebSocket(url, { headers: { Cookie: cookie } });
}

async function main() {
  const cookie = await login();
  const matchId = randomUUID();

  const ws1 = connect(matchId, cookie);
  const closed1: { code?: number; reason?: string } = {};
  ws1.on("close", (code, reason) => {
    closed1.code = code;
    closed1.reason = reason.toString();
  });

  await new Promise<void>((resolve, reject) => {
    ws1.once("open", () => resolve());
    ws1.once("error", reject);
    setTimeout(() => reject(new Error("ws1 open timeout")), 8000);
  });

  // 구 운영자 클라와 같이 onopen 즉시 ping — 서버 리스너가 이미 붙어 pong이 와야 한다
  ws1.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
  const first = await onceMessage(ws1, 3000);
  assert(first.type === "pong" || first.type === "connected", `first frame ${first.type}`);

  const need = first.type === "pong" ? "connected" : "pong";
  await waitType(ws1, need, 8000);
  assert(ws1.readyState === WebSocket.OPEN, "ws1 still open after ping+connected");

  // 예전 버그는 10초 pong 타임아웃. 서버가 끊지 않는지 12초 대기
  await sleep(12_000);
  assert(ws1.readyState === WebSocket.OPEN, `ws1 died during 12s wait code=${closed1.code} ${closed1.reason}`);

  ws1.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
  const pong2 = await waitType(ws1, "pong", 3000);
  assert(pong2.type === "pong", "second pong");

  const ws2 = connect(matchId, cookie);
  await new Promise<void>((resolve, reject) => {
    ws2.once("open", () => resolve());
    ws2.once("error", reject);
    setTimeout(() => reject(new Error("ws2 open timeout")), 8000);
  });
  ws2.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
  await waitType(ws2, "pong", 3000);

  await sleep(500);
  assert(
    closed1.code === 4010 || ws1.readyState !== WebSocket.OPEN,
    `ws1 should be replaced, code=${closed1.code} state=${ws1.readyState}`,
  );
  assert(ws2.readyState === WebSocket.OPEN, "ws2 must stay mapped after replacing ws1");

  ws2.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
  await waitType(ws2, "pong", 3000);

  ws2.close(1000, "test done");
  if (ws1.readyState === WebSocket.OPEN) ws1.close(1000, "test done");
  await sleep(200);

  console.log("OK: manager WS heartbeat (immediate ping, 12s hold, 4010 replace)");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
