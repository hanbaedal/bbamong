import type { LiveScoreSituation } from "@shared/apiSportsTypes";
import { DAUM_USER_AGENT, daumCpGameIdToNaverGameId } from "./daumHermesClient";

const NAVER_GAME_BASE = "https://api-gw.sports.naver.com/schedule/games";
const FETCH_TIMEOUT_MS = 15_000;
const RELAY_CACHE_MS = 4_000;

type RelayCache = { gameId: string; fetchedAt: number; situation: LiveScoreSituation | null };
const relayCache = new Map<string, RelayCache>();
const relayInflight = new Map<string, Promise<LiveScoreSituation | null>>();

type NaverLineupPlayer = { pcode?: string | number; name?: string };
type NaverTextOption = {
  type?: number;
  text?: string;
  pitchNum?: number;
  pitchResult?: string;
  speed?: string | number;
  stuff?: string;
};
type NaverRelayPayload = {
  result?: {
    textRelayData?: {
      homeOrAway?: string | number;
      currentGameState?: Record<string, unknown>;
      homeLineup?: { batter?: NaverLineupPlayer[] };
      awayLineup?: { batter?: NaverLineupPlayer[] };
      homeEntry?: { batter?: NaverLineupPlayer[]; pitcher?: NaverLineupPlayer[] };
      awayEntry?: { batter?: NaverLineupPlayer[]; pitcher?: NaverLineupPlayer[] };
      textRelays?: Array<{ title?: string; textOptions?: NaverTextOption[] }>;
    };
  };
};

function toCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function occupied(value: unknown): boolean {
  const raw = String(value ?? "").trim();
  return raw !== "" && raw !== "0";
}

function playerNameByCode(
  players: NaverLineupPlayer[] | undefined,
  pcode: string,
): string | null {
  if (!pcode) return null;
  const found = (players ?? []).find((row) => String(row.pcode ?? "") === pcode);
  const name = found?.name?.trim();
  return name || null;
}

function pitchResultKo(result?: string): string {
  const key = (result ?? "").trim().toUpperCase();
  if (key === "B") return "볼";
  if (key === "T" || key === "C") return "스트라이크";
  if (key === "S") return "헛스윙";
  if (key === "F") return "파울";
  if (key === "H") return "타격";
  return "";
}

function parseLastPitch(
  relays: Array<{ title?: string; textOptions?: NaverTextOption[] }> | undefined,
  batterName?: string | null,
): {
  pitchLabel: string | null;
  pitchDetail: string | null;
} {
  let last: NaverTextOption | null = null;
  for (const relay of [...(relays ?? [])].reverse()) {
    const pitches = (relay.textOptions ?? []).filter(
      (option) => option.type === 1 && option.pitchNum != null,
    );
    if (pitches.length === 0) continue;
    const title = (relay.title ?? "").replace(/\s+/g, "");
    const name = (batterName ?? "").replace(/\s+/g, "");
    if (name && title && !title.includes(name)) continue;
    last = pitches[pitches.length - 1] ?? null;
    break;
  }
  if (!last) return { pitchLabel: null, pitchDetail: null };
  const text = (last.text ?? "").trim();
  const pitchLabel = /^\d+구\s/.test(text)
    ? text
    : last.pitchNum != null
      ? `${last.pitchNum}구${pitchResultKo(last.pitchResult) ? ` ${pitchResultKo(last.pitchResult)}` : ""}`
      : null;
  const speed = String(last.speed ?? "").trim();
  const stuff = (last.stuff ?? "").trim();
  const pitchDetail = speed && stuff ? `${speed}km/h ${stuff}` : stuff || null;
  return { pitchLabel, pitchDetail };
}

export function parseNaverLiveSituation(payload: unknown): LiveScoreSituation | null {
  const relay =
    payload && typeof payload === "object" ? (payload as NaverRelayPayload).result?.textRelayData : null;
  const state = relay?.currentGameState;
  if (!state || typeof state !== "object") return null;

  const batterId = String(state.batter ?? "").trim();
  const battingAway = String(relay?.homeOrAway ?? "0") !== "1";
  const lineup = battingAway ? relay?.awayLineup?.batter : relay?.homeLineup?.batter;
  const entry = battingAway ? relay?.awayEntry?.batter : relay?.homeEntry?.batter;
  const batterName = playerNameByCode(lineup, batterId) || playerNameByCode(entry, batterId);
  const pitch = parseLastPitch(relay?.textRelays, batterName);

  return {
    balls: toCount(state.ball),
    strikes: toCount(state.strike),
    outs: toCount(state.out),
    first: occupied(state.base1),
    second: occupied(state.base2),
    third: occupied(state.base3),
    batterName,
    pitchLabel: pitch.pitchLabel,
    pitchDetail: pitch.pitchDetail,
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
    const situation = parseNaverLiveSituation(await res.json());
    relayCache.set(gameId, { gameId, fetchedAt: Date.now(), situation });
    return situation;
  })().finally(() => {
    relayInflight.delete(gameId);
  });

  relayInflight.set(gameId, request);
  return request;
}

type H2hCache = { gameId: string; fetchedAt: number; awayWins: number; homeWins: number };
const H2H_CACHE_MS = 30 * 60_000;
const h2hCache = new Map<string, H2hCache>();

/** 네이버 preview `seasonVsResult` — 원정(aw)·홈(hw) 시즌 상대 승수 */
export async function fetchNaverSeasonHeadToHead(
  cpGameId?: string | null,
): Promise<{ awayWins: number; homeWins: number } | null> {
  const gameId = daumCpGameIdToNaverGameId(cpGameId);
  if (!gameId) return null;

  const cached = h2hCache.get(gameId);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < H2H_CACHE_MS) {
    return { awayWins: cached.awayWins, homeWins: cached.homeWins };
  }

  const url = `${NAVER_GAME_BASE}/${encodeURIComponent(gameId)}/preview`;
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
    throw new Error(`네이버 상대전적 응답 ${res.status}`);
  }
  const payload = (await res.json()) as {
    result?: {
      previewData?: {
        seasonVsResult?: { aw?: number; hw?: number };
      };
    };
  };
  const vs = payload.result?.previewData?.seasonVsResult;
  const awayWins = Number(vs?.aw);
  const homeWins = Number(vs?.hw);
  if (!Number.isFinite(awayWins) || !Number.isFinite(homeWins)) return null;
  h2hCache.set(gameId, { gameId, fetchedAt: Date.now(), awayWins, homeWins });
  return { awayWins, homeWins };
}
