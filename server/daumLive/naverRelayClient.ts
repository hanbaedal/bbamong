import type {
  LiveBatterTodayStats,
  LivePitcherSummary,
  LivePitchLocation,
  LiveScoreSituation,
  LiveSuggestedPredictionResult,
} from "@shared/apiSportsTypes";
import { DAUM_USER_AGENT, daumCpGameIdToNaverGameId } from "./daumHermesClient";

const NAVER_GAME_BASE = "https://api-gw.sports.naver.com/schedule/games";
const FETCH_TIMEOUT_MS = 15_000;
/** 실황 폴링(2s)보다 짧아야 캐시가 폴링을 막지 않음 */
const RELAY_CACHE_MS = 900;

type RelayCache = { gameId: string; fetchedAt: number; situation: LiveScoreSituation | null; rawRelays?: any[] };
const relayCache = new Map<string, RelayCache>();
const relayInflight = new Map<string, Promise<LiveScoreSituation | null>>();

type NaverLineupPlayer = {
  pcode?: string | number;
  name?: string;
  hitType?: string;
  hittype?: string;
  pitchingStyle?: string;
  backnum?: string | number;
  seasonEra?: string | number;
  era?: string | number;
  inn?: string | number;
  kk?: string | number;
  run?: string | number;
  hit?: string | number;
  hr?: string | number;
  ab?: string | number;
  pa?: string | number;
  rbi?: string | number;
  so?: string | number;
  bb?: string | number;
  ballCount?: string | number;
  seasonWin?: string | number;
  seasonLose?: string | number;
  w?: string | number;
  l?: string | number;
};
type NaverTextOption = {
  type?: number;
  text?: string;
  pitchNum?: number;
  pitchResult?: string;
  speed?: string | number;
  stuff?: string;
  ptsPitchId?: string;
  currentPlayersInfo?: {
    home?: { playerType?: string; currentGamePlayerStats?: Record<string, unknown> };
    away?: { playerType?: string; currentGamePlayerStats?: Record<string, unknown> };
  };
};
type NaverPtsOption = {
  pitchId?: string;
  ballcount?: number;
  crossPlateX?: number;
  crossPlateY?: number;
  topSz?: number;
  bottomSz?: number;
  vy0?: number;
  vz0?: number;
  vx0?: number;
  z0?: number;
  y0?: number;
  x0?: number;
  ax?: number;
  ay?: number;
  az?: number;
  stance?: string;
};
type NaverRelayPayload = {
  result?: {
    textRelayData?: {
      homeOrAway?: string | number;
      currentGameState?: Record<string, unknown>;
      homeLineup?: { batter?: NaverLineupPlayer[]; pitcher?: NaverLineupPlayer[] };
      awayLineup?: { batter?: NaverLineupPlayer[]; pitcher?: NaverLineupPlayer[] };
      homeEntry?: { batter?: NaverLineupPlayer[]; pitcher?: NaverLineupPlayer[] };
      awayEntry?: { batter?: NaverLineupPlayer[]; pitcher?: NaverLineupPlayer[] };
      textRelays?: Array<{
        title?: string;
        textOptions?: NaverTextOption[];
        ptsOptions?: NaverPtsOption[];
      }>;
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

function playerRowByCode(
  players: NaverLineupPlayer[] | undefined,
  pcode: string,
): NaverLineupPlayer | null {
  if (!pcode) return null;
  return (players ?? []).find((row) => String(row.pcode ?? "") === pcode) ?? null;
}

function batsSideFromHitType(hitType?: string | null): "left" | "right" | null {
  const raw = (hitType ?? "").replace(/\s+/g, "");
  if (!raw) return null;
  if (raw.includes("좌타")) return "left";
  if (raw.includes("우타")) return "right";
  return null;
}

function resolveBatterToday(
  row: NaverLineupPlayer | null,
): LiveBatterTodayStats | null {
  if (!row) return null;
  return {
    atBats: toOptionalNumber(row.ab),
    hits: toOptionalNumber(row.hit),
    homeRuns: toOptionalNumber(row.hr),
    rbi: toOptionalNumber(row.rbi),
    runs: toOptionalNumber(row.run),
    strikeouts: toOptionalNumber(row.so),
    walks: toOptionalNumber(row.bb),
  };
}

/** y≈55ft → 플레이트 앞면(~1.417ft) 도달 시 z 높이.
 *  주의: Naver ptsOptions.crossPlateY 는 플레이트 반폭(≈0.71)이라 yPlate 로 쓰지 않는다. */
function plateArrivalZ(p: NaverPtsOption): number | null {
  const y0 = Number(p.y0);
  const vy0 = Number(p.vy0);
  const ay = Number(p.ay);
  const z0 = Number(p.z0);
  const vz0 = Number(p.vz0);
  const az = Number(p.az);
  if (![y0, vy0, ay, z0, vz0, az].every(Number.isFinite)) return null;
  const yPlate = 1.417;
  const a = 0.5 * ay;
  const b = vy0;
  const c = y0 - yPlate;
  let t: number;
  const disc = b * b - 4 * a * c;
  if (disc < 0 || Math.abs(a) < 1e-9) {
    if (Math.abs(vy0) < 1e-9) return null;
    t = (yPlate - y0) / vy0;
  } else {
    const t1 = (-b - Math.sqrt(disc)) / (2 * a);
    const t2 = (-b + Math.sqrt(disc)) / (2 * a);
    const positives = [t1, t2].filter((x) => x > 0);
    t = positives.length ? Math.min(...positives) : Math.max(t1, t2);
  }
  return z0 + vz0 * t + 0.5 * az * t * t;
}

function parseCurrentAtBatPitches(
  relays: Array<{
    title?: string;
    textOptions?: NaverTextOption[];
    ptsOptions?: NaverPtsOption[];
  }> | undefined,
  batterName?: string | null,
): LivePitchLocation[] {
  const name = (batterName ?? "").replace(/\s+/g, "");
  for (const relay of [...(relays ?? [])].reverse()) {
    const title = (relay.title ?? "").replace(/\s+/g, "");
    if (!name) break;
    if (!title) continue;
    const titleMatchesBatter = title.includes(name);
    const pinchForBatter = title.includes("대타") && title.includes(name);
    if (!titleMatchesBatter && !pinchForBatter) continue;
    const pts = relay.ptsOptions ?? [];
    if (pts.length === 0) continue;
    const byId = new Map<string, NaverTextOption>();
    for (const option of relay.textOptions ?? []) {
      if (option.ptsPitchId) byId.set(option.ptsPitchId, option);
    }
    const out: LivePitchLocation[] = [];
    for (const p of pts) {
      const plateX = Number(p.crossPlateX);
      if (!Number.isFinite(plateX)) continue;
      const plateZ = plateArrivalZ(p);
      if (plateZ == null || !Number.isFinite(plateZ)) continue;
      const text = p.pitchId ? byId.get(p.pitchId) : undefined;
      const stanceRaw = (p.stance ?? "").toUpperCase();
      out.push({
        pitchNum: Number(p.ballcount ?? text?.pitchNum ?? out.length + 1),
        result: text?.pitchResult ?? null,
        plateX,
        plateZ,
        topSz: Number(p.topSz) || 3.5,
        bottomSz: Number(p.bottomSz) || 1.5,
        stance: stanceRaw === "L" ? "L" : stanceRaw === "R" ? "R" : null,
        stuff: text?.stuff ?? null,
        speed: toOptionalNumber(text?.speed),
      });
    }
    if (out.length) return out;
  }
  return [];
}

function latestPitcherGameCounts(
  relays: Array<{ textOptions?: NaverTextOption[] }> | undefined,
): { strikes: number | null; balls: number | null } {
  let best: { strikes: number; balls: number; score: number } | null = null;
  for (const relay of relays ?? []) {
    for (const option of relay.textOptions ?? []) {
      const info = option.currentPlayersInfo;
      if (!info) continue;
      for (const side of [info.home, info.away]) {
        if (side?.playerType !== "pitcher") continue;
        const st = side.currentGamePlayerStats ?? {};
        // Naver currentGamePlayerStats: ballCount=볼, strikeCount=스트라이크 (합≈투구수)
        const strikes = toOptionalNumber(st.strikeCount);
        const balls = toOptionalNumber(st.ballCount);
        if (strikes == null && balls == null) continue;
        const s = strikes ?? 0;
        const b = balls ?? 0;
        const score = s + b;
        if (!best || score >= best.score) {
          best = { strikes: s, balls: b, score };
        }
      }
    }
  }
  return best
    ? { strikes: best.strikes, balls: best.balls }
    : { strikes: null, balls: null };
}

function playerNameByCode(
  players: NaverLineupPlayer[] | undefined,
  pcode: string,
): string | null {
  const name = playerRowByCode(players, pcode)?.name?.trim();
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

function toOptionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function handLabel(row: NaverLineupPlayer | null | undefined): string | null {
  const raw = String(row?.hitType ?? row?.hittype ?? row?.pitchingStyle ?? "").trim();
  if (!raw) return null;
  if (/좌/.test(raw) || /L/i.test(raw)) return "좌투";
  if (/우/.test(raw) || /R/i.test(raw)) return "우투";
  return raw;
}

function findPitcherRow(
  lists: Array<NaverLineupPlayer[] | undefined>,
  pcode: string,
): NaverLineupPlayer | null {
  if (!pcode) return null;
  for (const list of lists) {
    const found = (list ?? []).find((row) => String(row.pcode ?? "") === pcode);
    if (found) return found;
  }
  return null;
}

function countPitchResults(
  relays: Array<{ title?: string; textOptions?: NaverTextOption[] }> | undefined,
  pitcherName: string | null,
): { strikes: number; balls: number } {
  let strikes = 0;
  let balls = 0;
  const name = (pitcherName ?? "").replace(/\s+/g, "");
  for (const relay of relays ?? []) {
    const title = (relay.title ?? "").replace(/\s+/g, "");
    // 투수명 블록이 있으면 우선, 없어도 type=1 피치 집계
    for (const option of relay.textOptions ?? []) {
      if (option.type !== 1) continue;
      const key = (option.pitchResult ?? "").trim().toUpperCase();
      if (key === "B") balls += 1;
      else if (key === "T" || key === "C" || key === "S" || key === "F") strikes += 1;
    }
    void title;
    void name;
  }
  return { strikes, balls };
}

/** currentGameState.pitcher(pcode) → 라인업/엔트리에서 현재 투수 해석 */
function resolveCurrentPitcher(
  relay: NonNullable<NaverRelayPayload["result"]>["textRelayData"],
  battingAway: boolean,
): LivePitcherSummary | null {
  const state = relay?.currentGameState;
  const pitcherId = String(state?.pitcher ?? "").trim();
  // 타자가 원정이면 수비=홈 투수
  const defenseLineup = battingAway ? relay?.homeLineup?.pitcher : relay?.awayLineup?.pitcher;
  const defenseEntry = battingAway ? relay?.homeEntry?.pitcher : relay?.awayEntry?.pitcher;
  const offenseLineup = battingAway ? relay?.awayLineup?.pitcher : relay?.homeLineup?.pitcher;
  const offenseEntry = battingAway ? relay?.awayEntry?.pitcher : relay?.homeEntry?.pitcher;

  let row =
    findPitcherRow([defenseLineup, defenseEntry, offenseLineup, offenseEntry], pitcherId) ??
    null;

  // pcode 없으면 수비 라인업 첫 투수(폴백)
  if (!row) {
    row = (defenseLineup?.[0] ?? defenseEntry?.[0] ?? null) as NaverLineupPlayer | null;
  }
  const name = row?.name?.trim() || null;
  if (!name) return null;

  const liveCounts = latestPitcherGameCounts(relay?.textRelays);
  const pitchSplit = countPitchResults(relay?.textRelays, name);
  const wins = toOptionalNumber(row.seasonWin ?? row.w);
  const losses = toOptionalNumber(row.seasonLose ?? row.l);
  const eraRaw = row.seasonEra ?? row.era;
  const era = eraRaw != null && String(eraRaw).trim() !== "" ? String(eraRaw).trim() : null;

  return {
    name,
    hand: handLabel(row),
    backNumber: row.backnum != null ? String(row.backnum) : null,
    wins,
    losses,
    era,
    innings: row.inn != null ? String(row.inn) : null,
    strikeouts: toOptionalNumber(row.kk),
    runsAllowed: toOptionalNumber(row.run),
    hitsAllowed: toOptionalNumber(row.hit),
    pitchCount: toOptionalNumber(row.ballCount),
    strikes: liveCounts.strikes ?? (pitchSplit.strikes || null),
    balls: liveCounts.balls ?? (pitchSplit.balls || null),
  };
}

/** 문자중계에 투수교체 문구가 있는지 확인 (최근 12문장) */
export function hasRelayPitcherChangeText(
  relays: Array<{ title?: string; textOptions?: NaverTextOption[] }> | undefined,
): boolean {
  const texts: string[] = [];
  for (const relay of [...(relays ?? [])].reverse()) {
    texts.push((relay.title ?? "").replace(/\s+/g, ""));
    for (const option of relay.textOptions ?? []) {
      const t = (option.text ?? "").trim();
      if (t) texts.push(t);
    }
    if (texts.length >= 20) break;
  }
  const blob = texts.join(" ");
  return /투수\s*교체|투수\s*교대|교체\s*투수|계투/.test(blob);
}

/** 문자중계에서 병살 여부 확인 (최근 8문장) */
export function hasRelayDoublePlays(
  relays: Array<{ title?: string; textOptions?: NaverTextOption[] }> | undefined,
): boolean {
  const texts: string[] = [];
  for (const relay of [...(relays ?? [])].reverse()) {
    for (const option of relay.textOptions ?? []) {
      const t = (option.text ?? "").trim();
      if (t) texts.push(t);
    }
    if (texts.length >= 12) break;
  }
  const blob = texts.join(" ");
  return /병살|더블\s*플레이|겹살/.test(blob);
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
      continue;
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
  // 1루 성공: 1루타·포볼(볼넷)·데드볼(사구)·실책출루
  if (
    /포\s*볼|볼\s*넷|볼넷|사\s*구|사구|데드\s*볼|데드볼|몸에\s*맞는|고의\s*사구|사사구|walk|hbp/i.test(
      blob,
    )
  ) {
    return "1루";
  }
  if (/1루\s*타|내야안타|번트안타|안타|실책\s*출루|야수\s*선택|야수선택/.test(blob)) return "1루";
  // 아웃: 삼진·플라이·땅볼·병살·희생·인필드플라이 등 (타자 아웃)
  if (
    /삼진|뜬공|플라이|희생\s*플라이|희생플라이|희생\s*번트|희생번트|땅볼|직선타|라이너|병살|인필드\s*플라이|터치아웃|도루자|견제사|스트라이크\s*아웃|아웃/.test(
      blob,
    )
  ) {
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
  const batterRow = playerRowByCode(lineup, batterId) || playerRowByCode(entry, batterId);
  const batterName = batterRow?.name?.trim() || playerNameByCode(lineup, batterId) || playerNameByCode(entry, batterId);
  const pitch = parseLastPitch(relay?.textRelays, batterName);
  const pitcher = resolveCurrentPitcher(relay, battingAway);
  const suggestedResult = inferSuggestedResultFromRelays(relay?.textRelays, batterName);
  const batterToday = resolveBatterToday(batterRow);
  const pitchLocations = parseCurrentAtBatPitches(relay?.textRelays, batterName);
  const batsSide =
    batsSideFromHitType(batterRow?.hitType ?? batterRow?.hittype) ??
    (pitchLocations[0]?.stance === "L"
      ? "left"
      : pitchLocations[0]?.stance === "R"
        ? "right"
        : null);

  // currentGameState 에도 homeScore/awayScore/hit/error 가 있으나 점수는 다음이 주인.
  return {
    balls: toCount(state.ball),
    strikes: toCount(state.strike),
    outs: toCount(state.out),
    first: occupied(state.base1),
    second: occupied(state.base2),
    third: occupied(state.base3),
    batterName,
    pitcherName: pitcher?.name ?? null,
    pitcher,
    batterToday,
    batsSide,
    pitchLocations: pitchLocations.length ? pitchLocations : null,
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
    const json = await res.json();
    const situation = parseNaverLiveSituation(json);
    const rawRelays = (json as NaverRelayPayload)?.result?.textRelayData?.textRelays;
    relayCache.set(gameId, { gameId, fetchedAt: Date.now(), situation, rawRelays });
    return situation;
  })().finally(() => {
    relayInflight.delete(gameId);
  });

  relayInflight.set(gameId, request);
  return request;
}

/** 캐시된 최신 네이버 문자중계 텍스트를 반환 (투수교체·병살 판정용) */
export function getCachedRelayTexts(cpGameId?: string | null): any[] | undefined {
  const gameId = daumCpGameIdToNaverGameId(cpGameId);
  if (!gameId) return undefined;
  const cached = relayCache.get(gameId);
  if (!cached || Date.now() - cached.fetchedAt > RELAY_CACHE_MS * 3) return undefined;
  return cached.rawRelays;
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
