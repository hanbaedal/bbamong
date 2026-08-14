import { resolveKboTeamShortName } from "@shared/kboHomeStadium";

export const DAUM_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const DAUM_LIST_URL = "https://sports.daum.net/prx/hermes/api/game/list.json";
const DAUM_TEAM_RANK_URL = "https://sports.daum.net/prx/hermes/api/team/rank.json";
const DAUM_PERSON_RANK_URL = "https://sports.daum.net/prx/hermes/api/person/rank.json";
const FETCH_TIMEOUT_MS = 20_000;
const LIST_CACHE_MS = 4_000;
const TEAM_RANK_CACHE_MS = 30 * 60_000;
const PERSON_RANK_CACHE_MS = 30 * 60_000;

export type DaumTeamBlock = {
  team?: {
    nameKo?: string;
    name?: string;
    shortNameKo?: string;
    shortName?: string;
    imageUrl?: string;
  };
};

export type DaumScoreBlock = {
  run?: number;
  hit?: number;
  error?: number;
  ballfour?: number;
  inning?: string;
};

export type DaumListGame = {
  gameId?: number;
  cpGameId?: string;
  startTime?: string;
  gameStatus?: string;
  periodType?: string;
  gameUrl?: string;
  home?: DaumTeamBlock;
  away?: DaumTeamBlock;
  homeScore?: DaumScoreBlock;
  awayScore?: DaumScoreBlock;
};

export function daumCpGameIdToNaverGameId(cpGameId?: string | null): string | null {
  const id = String(cpGameId ?? "").replace(/\|/g, "").trim();
  return id.length >= 8 ? id : null;
}

type ListCache = { dateYmd: string; fetchedAt: number; games: DaumListGame[] };
let listCache: ListCache | null = null;
let listInflight: Promise<DaumListGame[]> | null = null;

type TeamRankCache = { season: number; fetchedAt: number; list: DaumTeamRankRow[] };
let teamRankCache: TeamRankCache | null = null;
let teamRankInflight: Promise<DaumTeamRankRow[]> | null = null;

type PersonRankCache = { season: number; fetchedAt: number; list: DaumPersonBattingRow[] };
let personRankCache: PersonRankCache | null = null;
let personRankInflight: Promise<DaumPersonBattingRow[]> | null = null;

export type DaumTeamRankRow = {
  shortNameKo?: string;
  shortName?: string;
  nameKo?: string;
  rank?: {
    rank?: number;
    win?: number;
    draw?: number;
    loss?: number;
    wpct?: number;
    gb?: string;
  };
  stat?: {
    batAvg?: number;
    pitEra?: number;
  };
};

export type DaumPersonBattingRow = {
  nameKo?: string;
  name?: string;
  team?: { shortNameKo?: string; shortName?: string; nameKo?: string };
  stat?: {
    batAvg?: number;
    batHr?: number;
    batH?: number;
    batRbi?: number;
    batR?: number;
    batSb?: number;
    batObp?: number;
    batOps?: number;
  };
};

export async function fetchDaumJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": DAUM_USER_AGENT,
      Accept: "application/json",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
      Referer: "https://sports.daum.net/",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`다음 스포츠 응답 ${res.status}`);
  }
  return res.json();
}

export async function fetchDaumKboGameList(dateYmd: string): Promise<DaumListGame[]> {
  const key = dateYmd.replace(/-/g, "");
  if (!/^\d{8}$/.test(key)) {
    throw new Error("날짜 형식이 올바르지 않습니다.");
  }
  const now = Date.now();
  if (listCache && listCache.dateYmd === key && now - listCache.fetchedAt < LIST_CACHE_MS) {
    return listCache.games;
  }
  if (listInflight) return listInflight;

  listInflight = (async () => {
    const url = `${DAUM_LIST_URL}?date=${encodeURIComponent(key)}&leagueCode=kbo`;
    const payload = await fetchDaumJson(url);
    const list =
      payload && typeof payload === "object" && Array.isArray((payload as { list?: unknown }).list)
        ? ((payload as { list: DaumListGame[] }).list)
        : [];
    const games = list.filter((game) => Number.isFinite(Number(game.gameId)));
    listCache = { dateYmd: key, fetchedAt: Date.now(), games };
    return games;
  })().finally(() => {
    listInflight = null;
  });

  return listInflight;
}

export function daumTeamShort(block?: DaumTeamBlock): string {
  const name = block?.team?.nameKo || block?.team?.name || "";
  const shortRaw = block?.team?.shortNameKo || block?.team?.shortName || name;
  return resolveKboTeamShortName(shortRaw) || resolveKboTeamShortName(name) || shortRaw.trim();
}

export function daumTeamName(block?: DaumTeamBlock): string {
  return (block?.team?.nameKo || block?.team?.name || daumTeamShort(block)).trim();
}

export function daumTeamLogo(block?: DaumTeamBlock): string | null {
  const raw = block?.team?.imageUrl?.trim();
  if (!raw) return null;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("http://")) return `https://${raw.slice("http://".length)}`;
  return raw;
}

export function findDaumGameForMatch(
  games: DaumListGame[],
  input: {
    daumGameId?: number | null;
    homeTeam?: string | null;
    awayTeam?: string | null;
  },
): DaumListGame | null {
  if (input.daumGameId != null) {
    const byId = games.find((game) => Number(game.gameId) === input.daumGameId);
    if (byId) return byId;
  }
  const home = resolveKboTeamShortName(input.homeTeam);
  const away = resolveKboTeamShortName(input.awayTeam);
  if (!home || !away) return null;
  return (
    games.find((game) => daumTeamShort(game.home) === home && daumTeamShort(game.away) === away) ??
    null
  );
}

export async function fetchDaumTeamRank(season: number): Promise<DaumTeamRankRow[]> {
  const year = Math.round(season);
  const now = Date.now();
  if (teamRankCache && teamRankCache.season === year && now - teamRankCache.fetchedAt < TEAM_RANK_CACHE_MS) {
    return teamRankCache.list;
  }
  if (teamRankInflight) return teamRankInflight;

  teamRankInflight = (async () => {
    const url = `${DAUM_TEAM_RANK_URL}?leagueCode=kbo&seasonKey=${encodeURIComponent(String(year))}`;
    const payload = await fetchDaumJson(url);
    const list =
      payload && typeof payload === "object" && Array.isArray((payload as { list?: unknown }).list)
        ? ((payload as { list: DaumTeamRankRow[] }).list)
        : [];
    teamRankCache = { season: year, fetchedAt: Date.now(), list };
    return list;
  })().finally(() => {
    teamRankInflight = null;
  });

  return teamRankInflight;
}

export async function fetchDaumPersonBattingRank(season: number): Promise<DaumPersonBattingRow[]> {
  const year = Math.round(season);
  const now = Date.now();
  if (
    personRankCache &&
    personRankCache.season === year &&
    now - personRankCache.fetchedAt < PERSON_RANK_CACHE_MS
  ) {
    return personRankCache.list;
  }
  if (personRankInflight) return personRankInflight;

  personRankInflight = (async () => {
    const collected: DaumPersonBattingRow[] = [];
    for (const page of [1, 2]) {
      const url =
        `${DAUM_PERSON_RANK_URL}?leagueCode=kbo&seasonKey=${encodeURIComponent(String(year))}` +
        `&detail=batting&sort=batPa&page=${page}&pageSize=200`;
      const payload = await fetchDaumJson(url);
      const list =
        payload && typeof payload === "object" && Array.isArray((payload as { list?: unknown }).list)
          ? ((payload as { list: DaumPersonBattingRow[] }).list)
          : [];
      collected.push(...list);
      const total =
        payload && typeof payload === "object"
          ? Number((payload as { pagingInfo?: { totalCount?: number } }).pagingInfo?.totalCount)
          : 0;
      if (list.length < 200 || (Number.isFinite(total) && collected.length >= total)) break;
    }
    personRankCache = { season: year, fetchedAt: Date.now(), list: collected };
    return collected;
  })().finally(() => {
    personRankInflight = null;
  });

  return personRankInflight;
}
