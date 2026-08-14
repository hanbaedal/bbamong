import { resolveKboTeamShortName } from "@shared/kboHomeStadium";

export const DAUM_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const DAUM_LIST_URL = "https://sports.daum.net/prx/hermes/api/game/list.json";
const FETCH_TIMEOUT_MS = 20_000;
const LIST_CACHE_MS = 4_000;

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

type ListCache = { dateYmd: string; fetchedAt: number; games: DaumListGame[] };
let listCache: ListCache | null = null;
let listInflight: Promise<DaumListGame[]> | null = null;

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
