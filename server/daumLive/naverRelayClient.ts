import type { LiveScoreSituation } from "@shared/apiSportsTypes";
import { DAUM_USER_AGENT, daumCpGameIdToNaverGameId } from "./daumHermesClient";

const NAVER_GAME_BASE = "https://api-gw.sports.naver.com/schedule/games";
const FETCH_TIMEOUT_MS = 15_000;
const RELAY_CACHE_MS = 4_000;

type RelayCache = { gameId: string; fetchedAt: number; situation: LiveScoreSituation | null };
const relayCache = new Map<string, RelayCache>();
const relayInflight = new Map<string, Promise<LiveScoreSituation | null>>();

function toCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function occupied(value: unknown): boolean {
  const raw = String(value ?? "").trim();
  return raw !== "" && raw !== "0";
}

function parseSituation(payload: unknown): LiveScoreSituation | null {
  const state =
    payload && typeof payload === "object"
      ? ((payload as {
          result?: { textRelayData?: { currentGameState?: Record<string, unknown> } };
        }).result?.textRelayData?.currentGameState ?? null)
      : null;
  if (!state || typeof state !== "object") return null;
  return {
    balls: toCount(state.ball),
    strikes: toCount(state.strike),
    outs: toCount(state.out),
    first: occupied(state.base1),
    second: occupied(state.base2),
    third: occupied(state.base3),
  };
}

export async function fetchNaverLiveSituation(cpGameId?: string | null): Promise<LiveScoreSituation | null> {
  const gameId = daumCpGameIdToNaverGameId(cpGameId);
  if (!gameId) return null;

  const now = Date.now();
  const cached = relayCache.get(gameId);
  if (cached && now - cached.fetchedAt < RELAY_CACHE_MS) {
    return cached.situation;
  }
  const inflight = relayInflight.get(gameId);
  if (inflight) return inflight;

  const request = (async () => {
    const url = `${NAVER_GAME_BASE}/${encodeURIComponent(gameId)}/relay`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": DAUM_USER_AGENT,
        Accept: "application/json",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        Referer: "https://m.sports.naver.com/",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`네이버 문자중계 응답 ${res.status}`);
    }
    const situation = parseSituation(await res.json());
    relayCache.set(gameId, { gameId, fetchedAt: Date.now(), situation });
    return situation;
  })().finally(() => {
    relayInflight.delete(gameId);
  });

  relayInflight.set(gameId, request);
  return request;
}
