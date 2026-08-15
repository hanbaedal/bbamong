import type {
  LiveScoreSituation,
  LiveSuggestedPredictionResult,
} from "@shared/apiSportsTypes";
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

function currentPitcherName(
  relay: NonNullable<NaverRelayPayload["result"]>["textRelayData"],
  battingAway: boolean,
): string | null {
  // 타자가 원정이면 수비=홈 투수
  const pitchers = battingAway ? relay?.homeEntry?.pitcher : relay?.awayEntry?.pitcher;
  const name = pitchers?.[0]?.name?.trim();
  return name || null;
}

/** 문자중계 최근 문장에서 예측 결과 추정 */
export function inferSuggestedResultFromRelays(
  relays: Array<{ title?: string; textOptions?: NaverTextOption[] }> | undefined,
  batterName?: string | null,
): LiveSuggestedPredictionResult | null {
  const name = (batterName ?? "").replace(/\s+/g, "");
  const texts: string[] = [];
  for (const relay of [...(relays ?? [])].reverse()) {
    const title = (relay.title ?? "").replace(/\s+/g, "");
    if (name && title && !title.includes(name) && !title.includes("결과")) {
      // 타자명과 무관한 블록은 건너뛰되, 결과 요약은 허용
    }
    for (const option of [...(relay.textOptions ?? [])].reverse()) {
      const text = (option.text ?? "").trim();
      if (text) texts.push(text);
    }
    if (texts.length >= 12) break;
  }
  const blob = texts.join(" ");
  if (!blob) return null;
  if (/홈\s*런|홈런/.test(blob)) return "홈런";
  if (/3루\s*타|3루타/.test(blob)) return "3루";
  if (/2루\s*타|2루타/.test(blob)) return "2루";
  // 1루 성공: 1루타·포볼(볼넷)·데드볼(사구) — 예측「1루」와 동일 정산
  if (
    /포\s*볼|볼\s*넷|볼넷|사\s*구|사구|데드\s*볼|데드볼|몸에\s*맞는|고의\s*사구|사사구|walk|hbp/i.test(
      blob,
    )
  ) {
    return "1루";
  }
  if (/1루\s*타|내야안타|번트안타|안타|실책/.test(blob)) return "1루";
  if (/삼진|뜬공|플라이|땅볼|직선타|라이너|병살|아웃|도루자|견제사|터치아웃/.test(blob)) {
    return "아웃";
  }
  return null;
}

/** 네이버 문자중계 → 주자·카운트·타자·구종 전용. 점수·이닝은 파싱하지 않는다. */
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
  const pitcherName = currentPitcherName(relay, battingAway);
  const suggestedResult = inferSuggestedResultFromRelays(relay?.textRelays, batterName);

  // currentGameState 에도 homeScore/awayScore/hit/error 가 있으나 점수는 다음이 주인.
  return {
    balls: toCount(state.ball),
    strikes: toCount(state.strike),
    outs: toCount(state.out),
    first: occupied(state.base1),
    second: occupied(state.base2),
    third: occupied(state.base3),
    batterName,
    pitcherName,
    pitchLabel: pitch.pitchLabel,
    pitchDetail: pitch.pitchDetail,
    suggestedResult,
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
