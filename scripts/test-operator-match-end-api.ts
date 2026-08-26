/**
 * 로컬 서버: op5 담당 경기를 completed로 바꿔도 GET/refresh가 즉시 403/401이 아닌지.
 * 끝나면 5경기 상태를 원래대로 되돌린다.
 * 실행: npx tsx scripts/test-operator-match-end-api.ts
 */
import "dotenv/config";
import { connectMongoDB, disconnectMongoDB } from "../server/mongodb/connect";
import { AdminUserModel, MatchModel } from "../server/mongodb/models";
import { syncOperatorAccountStatusForMatchId } from "../server/managerOperatorService";

const BASE = process.env.OPERATOR_MATCH_END_TEST_BASE || "http://127.0.0.1:5000";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
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

async function jsonFetch(
  url: string,
  init: RequestInit & { cookie?: string } = {},
): Promise<{ status: number; body: unknown; cookie: string; raw: Response }> {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set("Cookie", init.cookie);
  const res = await fetch(url, { ...init, headers });
  const cookie = cookieHeader(res.headers.getSetCookie?.() ?? undefined);
  let body: unknown = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body, cookie, raw: res };
}

async function main() {
  await connectMongoDB();

  const op5 = await AdminUserModel.findOne({ username: "op5", userType: "매니저" })
    .select("id status")
    .lean();
  assert(op5, "op5 not found");
  const OP5_ID = op5.id;

  const match = await MatchModel.findOne({
    registrationOrder: 5,
    matchDate: { $exists: true },
    matchStatus: { $in: ["scheduled", "ongoing"] },
  })
    .sort({ matchDate: -1 })
    .select("id matchStatus name")
    .lean();
  assert(match, "no scheduled/ongoing registrationOrder=5 match");
  const MATCH_ID = match.id;
  const originalStatus = match.matchStatus;
  console.log(`using ${match.name} ${MATCH_ID} status=${originalStatus}`);
  let managerCookie = "";

  try {
    const adminLogin = await jsonFetch(`${BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ppamong", password: "ppamong.0323" }),
    });
    assert(adminLogin.status === 200, `admin login ${adminLogin.status}`);
    const adminCookie = adminLogin.cookie;
    assert(adminCookie.includes("adminAccessToken"), "admin cookie");

    const rotated = await jsonFetch(`${BASE}/api/admin/operators/${OP5_ID}/rotate-password`, {
      method: "POST",
      cookie: adminCookie,
    });
    assert(rotated.status === 200, `rotate ${rotated.status} ${JSON.stringify(rotated.body)}`);
    const token = (rotated.body as { loginLinkToken?: string }).loginLinkToken;
    assert(token, "loginLinkToken");

    const mgrLogin = await jsonFetch(`${BASE}/api/manager/login-with-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    assert(mgrLogin.status === 200, `manager login ${mgrLogin.status} ${JSON.stringify(mgrLogin.body)}`);
    managerCookie = mgrLogin.cookie;
    assert(managerCookie.includes("managerAccessToken"), "manager cookie");

    const before = await jsonFetch(`${BASE}/api/manager/matches/${MATCH_ID}`, {
      cookie: managerCookie,
    });
    assert(before.status === 200, `GET match before ${before.status}`);

    await MatchModel.updateOne({ id: MATCH_ID }, { matchStatus: "completed" });
    await syncOperatorAccountStatusForMatchId(MATCH_ID);

    const opAfter = await AdminUserModel.findOne({ id: OP5_ID }).select("status username").lean();
    assert(opAfter?.status === "활성화", `op5 should stay 활성화 after completed sync, got ${opAfter?.status}`);

    const after = await jsonFetch(`${BASE}/api/manager/matches/${MATCH_ID}`, {
      cookie: managerCookie,
    });
    assert(after.status === 200, `GET match after complete should be 200, got ${after.status} ${JSON.stringify(after.body)}`);
    assert(
      (after.body as { matchStatus?: string }).matchStatus === "completed",
      "GET still returns the completed match (overlay can start without 403)",
    );

    const me = await jsonFetch(`${BASE}/api/manager/me`, { cookie: managerCookie });
    assert(me.status === 200, `GET /me after complete ${me.status} ${JSON.stringify(me.body)}`);

    const refresh = await jsonFetch(`${BASE}/api/manager/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cookie: managerCookie,
    });
    assert(
      refresh.status === 200,
      `refresh after complete should be 200, got ${refresh.status} ${JSON.stringify(refresh.body)}`,
    );

    const relogin = await jsonFetch(`${BASE}/api/manager/login-with-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    assert(
      relogin.status === 401 || relogin.status === 409,
      `new login after complete should be blocked, got ${relogin.status} ${JSON.stringify(relogin.body)}`,
    );

    console.log("OK: completed match keeps operator session (GET 200, refresh 200, op5 활성화)");
    console.log("login-link after complete:", relogin.status, JSON.stringify(relogin.body));
  } finally {
    await MatchModel.updateOne({ id: MATCH_ID }, { matchStatus: originalStatus });
    await AdminUserModel.updateOne({ id: OP5_ID }, { status: "활성화" });
    await disconnectMongoDB();
  }
}

main().catch(async (err) => {
  console.error(err);
  try {
    const op5 = await AdminUserModel.findOne({ username: "op5", userType: "매니저" }).select("id").lean();
    if (op5) await AdminUserModel.updateOne({ id: op5.id }, { status: "활성화" });
    await MatchModel.updateOne(
      { registrationOrder: 5, name: "5경기" },
      { matchStatus: "scheduled" },
    );
    await disconnectMongoDB();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
