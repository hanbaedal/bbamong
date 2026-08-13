/** API venue 없을 때 DB·화면에 쓰는 placeholder */
export const API_PLACEHOLDER_STADIUM_NAME = "API자동";

interface KboFranchise {
  aliases: string[];
  teamShort: string;
  stadiumShort: string;
}

/** KBO 10구단 — 표시용 팀·구장 약칭 */
const KBO_FRANCHISES: KboFranchise[] = [
  { aliases: ["doosan bears", "doosan", "두산 베어스", "두산"], teamShort: "두산", stadiumShort: "잠실" },
  { aliases: ["lg twins", "lg 트윈스", "엘지 트윈스", "엘지"], teamShort: "LG", stadiumShort: "잠실" },
  { aliases: ["kia tigers", "kia", "기아 타이거즈", "기아"], teamShort: "KIA", stadiumShort: "광주" },
  { aliases: ["lotte giants", "lotte", "롯데 자이언츠", "롯데"], teamShort: "롯데", stadiumShort: "사직" },
  { aliases: ["samsung lions", "samsung", "삼성 라이온즈", "삼성"], teamShort: "삼성", stadiumShort: "대구" },
  {
    aliases: ["ssg landers", "ssg", "ssg 랜더스", "랜더스", "sk wyverns"],
    teamShort: "SSG",
    stadiumShort: "인천",
  },
  { aliases: ["nc dinos", "nc", "nc 다이노스", "다이노스"], teamShort: "NC", stadiumShort: "창원" },
  { aliases: ["kt wiz suwon", "kt wiz", "kt 위즈", "kt"], teamShort: "KT", stadiumShort: "수원" },
  { aliases: ["kiwoom heroes", "kiwoom", "키움 히어로즈", "키움"], teamShort: "키움", stadiumShort: "고척" },
  {
    aliases: ["hanwha eagles", "hanwha", "한화 이글스", "한화"],
    teamShort: "한화",
    stadiumShort: "대전",
  },
];

/** 두산·LG·KIA·롯데·삼성·SSG·NC·KT·키움·한화 */
export const KBO_TEAM_SHORT_LIST = KBO_FRANCHISES.map((f) => f.teamShort);
export type KboTeamShort = (typeof KBO_TEAM_SHORT_LIST)[number];

const KBO_TEAM_SHORTS = new Set(KBO_TEAM_SHORT_LIST);
const KBO_STADIUM_SHORTS = new Set(KBO_FRANCHISES.map((f) => f.stadiumShort));

export function isKboTeamShort(value: string): value is KboTeamShort {
  return KBO_TEAM_SHORTS.has(value);
}

/** 구장 전체명·영문 → 약칭 */
const STADIUM_NAME_TO_SHORT: { patterns: string[]; short: string }[] = [
  { patterns: ["잠실", "jamsil"], short: "잠실" },
  { patterns: ["광주", "gwangju", "champions field", "기아 챔피언스"], short: "광주" },
  { patterns: ["사직", "sajik"], short: "사직" },
  { patterns: ["대구", "daegu", "lions park"], short: "대구" },
  { patterns: ["인천", "incheon", "landers field", "ssg landers"], short: "인천" },
  { patterns: ["창원", "changwon", "nc park"], short: "창원" },
  { patterns: ["수원", "suwon", "wiz park"], short: "수원" },
  { patterns: ["고척", "gocheok", "sky dome", "skydome"], short: "고척" },
  { patterns: ["대전", "daejeon", "eagles park", "한화생명"], short: "대전" },
];

function normalizeKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchFranchise(name?: string | null): KboFranchise | null {
  if (!name?.trim()) return null;
  const normalized = normalizeKey(name);

  let best: { franchise: KboFranchise; aliasLen: number } | null = null;
  for (const franchise of KBO_FRANCHISES) {
    for (const alias of franchise.aliases) {
      const normAlias = normalizeKey(alias);
      if (normalized === normAlias || normalized.includes(normAlias)) {
        if (!best || normAlias.length > best.aliasLen) {
          best = { franchise, aliasLen: normAlias.length };
        }
      }
    }
  }
  return best?.franchise ?? null;
}

function matchStadiumNameToShort(stadiumName: string): string | null {
  const trimmed = stadiumName.trim();
  if (KBO_STADIUM_SHORTS.has(trimmed)) return trimmed;

  const normalized = normalizeKey(trimmed);
  for (const entry of STADIUM_NAME_TO_SHORT) {
    for (const pattern of entry.patterns) {
      if (normalized.includes(normalizeKey(pattern))) return entry.short;
    }
  }
  return null;
}

/** API·DB 팀명 → 표시 약칭 (두산, LG, KIA …) */
export function resolveKboTeamShortName(teamName?: string | null): string | null {
  if (!teamName?.trim()) return null;
  const trimmed = teamName.trim();
  if (KBO_TEAM_SHORTS.has(trimmed)) return trimmed;
  return matchFranchise(trimmed)?.teamShort ?? null;
}

/** 화면·API 응답용 — 매칭 실패 시 원문 유지 */
export function formatKboTeamShortName(teamName?: string | null, fallback = ""): string {
  const trimmed = teamName?.trim();
  if (!trimmed) return fallback;
  return resolveKboTeamShortName(trimmed) ?? trimmed;
}

/** 구장명·홈팀 → 표시 약칭 (잠실, 광주 …) */
export function resolveKboStadiumShortName(input: {
  stadiumName?: string | null;
  homeTeamName?: string | null;
}): string | null {
  const stadium = input.stadiumName?.trim();
  if (
    stadium &&
    stadium !== API_PLACEHOLDER_STADIUM_NAME &&
    stadium !== "API 자동"
  ) {
    const fromName = matchStadiumNameToShort(stadium);
    if (fromName) return fromName;
  }
  return matchFranchise(input.homeTeamName)?.stadiumShort ?? null;
}

/** @deprecated resolveKboStadiumShortName 사용 */
export function resolveKboStadiumFromHomeTeam(homeTeamName?: string | null): string | null {
  return resolveKboStadiumShortName({ homeTeamName });
}

/** API 동기화 시 MongoDB stadium.name에 저장할 약칭 */
export function resolveVenueNameFromApiSportsGame(input: {
  apiVenueName?: string | null;
  homeTeamName?: string | null;
}): string {
  const fromVenue = input.apiVenueName?.trim();
  if (fromVenue && fromVenue !== API_PLACEHOLDER_STADIUM_NAME && fromVenue !== "API 자동") {
    const short = matchStadiumNameToShort(fromVenue);
    if (short) return short;
  }
  return resolveKboStadiumShortName({ homeTeamName: input.homeTeamName }) ?? API_PLACEHOLDER_STADIUM_NAME;
}
