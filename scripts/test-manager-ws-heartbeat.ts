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
  const map = new Map<string, string>();
  for (const raw of setCookie ?? []) {
    const pair = raw.split(";")[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    const k = pair.slice(0, eq).trim();
    const v = pair.slice(eq + 1).trim();
    if (k && v) map.set(k, v);
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function collectTypes(ws: WebSocket, bag: string[]) {
  ws.on("message", (raw) => {
    try {
      const parsed = JSON.parse(raw.toString()) as { type?: string };
      if (parsed.type) bag.push(parsed.type);
    } catch {
      /* ignore */
    }
  });
}

async function waitUntilHas(bag: string[], type: string, timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (bag.includes(type)) return;
    await sleep(50);
  }
  throw new Error(`wait ${type} timeout ${timeoutMs}ms got=${bag.join(",")}`);
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
  const types1: string[] = [];
  collectTypes(ws1, types1);
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
  await waitUntilHas(types1, "pong", 3000);
  await waitUntilHas(types1, "connected", 8000);
  assert(ws1.readyState === WebSocket.OPEN, "ws1 still open after ping+connected");

  // 예전 버그는 10초 pong 타임아웃. 서버가 끊지 않는지 12초 대기
  await sleep(12_000);
  assert(ws1.readyState === WebSocket.OPEN, `ws1 died during 12s wait code=${closed1.code} ${closed1.reason}`);

  const beforeSecond = types1.filter((t) => t === "pong").length;
  ws1.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
  const waitSecond = Date.now();
  while (Date.now() - waitSecond < 3000) {
    if (types1.filter((t) => t === "pong").length > beforeSecond) break;
    await sleep(50);
  }
  assert(types1.filter((t) => t === "pong").length > beforeSecond, "second pong");

  const ws2 = connect(matchId, cookie);
  const types2: string[] = [];
  collectTypes(ws2, types2);
  await new Promise<void>((resolve, reject) => {
    ws2.once("open", () => resolve());
    ws2.once("error", reject);
    setTimeout(() => reject(new Error("ws2 open timeout")), 8000);
  });
  ws2.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
  await waitUntilHas(types2, "pong", 3000);

  await sleep(500);
  assert(
    closed1.code === 4010 || ws1.readyState !== WebSocket.OPEN,
    `ws1 should be replaced, code=${closed1.code} state=${ws1.readyState}`,
  );
  assert(ws2.readyState === WebSocket.OPEN, "ws2 must stay mapped after replacing ws1");

  const pongBefore = types2.filter((t) => t === "pong").length;
  ws2.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
  const start = Date.now();
  while (Date.now() - start < 3000) {
    if (types2.filter((t) => t === "pong").length > pongBefore) break;
    await sleep(50);
  }
  assert(types2.filter((t) => t === "pong").length > pongBefore, "ws2 pong after replace");

  ws2.close(1000, "test done");
  if (ws1.readyState === WebSocket.OPEN) ws1.close(1000, "test done");
  await sleep(200);

  console.log("OK: manager WS heartbeat (immediate ping, 12s hold, 4010 replace)");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
