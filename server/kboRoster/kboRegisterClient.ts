import type { KboTeamShort } from "@shared/kboHomeStadium";
import { isKboBatterPosition, type KboBatterPosition } from "@shared/kboRoster";

const REGISTER_URL = "https://www.koreabaseball.com/Player/Register.aspx";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TEAM_FIELD = "ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$hfSearchTeam";
const DATE_FIELD = "ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$hfSearchDate";
const CALENDAR_TARGET = "ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$btnCalendarSelect";

/** KBO Register.aspx data-id → 앱 구단 약칭 */
export const KBO_REGISTER_TEAM_CODES: Record<KboTeamShort, string> = {
  KT: "KT",
  삼성: "SS",
  LG: "LG",
  두산: "OB",
  KIA: "HT",
  한화: "HH",
  NC: "NC",
  롯데: "LT",
  SSG: "SK",
  키움: "WO",
};

const PLAYER_GROUPS = new Set<KboBatterPosition>(["투수", "포수", "내야수", "외야수"]);

export type KboRegisterPlayer = {
  name: string;
  position: KboBatterPosition;
  jerseyNumber: string;
  batsThrows: string;
};

type AspNetState = {
  viewState: string;
  viewStateGenerator: string;
  eventValidation: string;
  searchDate: string;
};

function decodeHtmlAttr(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripTags(html: string): string {
  return decodeHtmlAttr(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function extractInputValue(html: string, idOrName: string): string {
  const escaped = idOrName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const byId = html.match(new RegExp(`id="${escaped}"[^>]*value="([^"]*)"`, "i"));
  if (byId) return decodeHtmlAttr(byId[1]);
  const byName = html.match(new RegExp(`name="${escaped}"[^>]*value="([^"]*)"`, "i"));
  if (byName) return decodeHtmlAttr(byName[1]);
  return "";
}

function mergeCookies(existing: string, setCookies: string[]): string {
  const map = new Map<string, string>();
  for (const part of existing.split(";").map((s) => s.trim()).filter(Boolean)) {
    const i = part.indexOf("=");
    if (i > 0) map.set(part.slice(0, i), part.slice(i + 1));
  }
  for (const header of setCookies) {
    const nv = header.split(";")[0] ?? "";
    const i = nv.indexOf("=");
    if (i > 0) map.set(nv.slice(0, i).trim(), nv.slice(i + 1));
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function parseAspNetState(html: string): AspNetState {
  const viewState = extractInputValue(html, "__VIEWSTATE");
  const viewStateGenerator = extractInputValue(html, "__VIEWSTATEGENERATOR");
  const eventValidation = extractInputValue(html, "__EVENTVALIDATION");
  const searchDate = extractInputValue(html, DATE_FIELD);
  if (!viewState || !eventValidation) {
    throw new Error("KBO 등록 페이지 상태를 읽지 못했습니다.");
  }
  return { viewState, viewStateGenerator, eventValidation, searchDate };
}

export function parseKboRegisterHtml(html: string): KboRegisterPlayer[] {
  const tables = html.match(/<table class="tNData"[\s\S]*?<\/table>/gi) ?? [];
  const players: KboRegisterPlayer[] = [];
  const seen = new Set<string>();

  for (const table of tables) {
    const header = table.match(
      /<th>\s*등번호\s*<\/th>\s*<th>\s*([^<]+)\s*<\/th>\s*<th>\s*투타유형\s*<\/th>/i,
    );
    if (!header) continue;
    const group = header[1].trim();
    if (!isKboBatterPosition(group) || !PLAYER_GROUPS.has(group)) continue;

    const rowRe =
      /<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>/gi;
    let row: RegExpExecArray | null;
    while ((row = rowRe.exec(table))) {
      const jerseyNumber = stripTags(row[1]);
      const name = stripTags(row[2]);
      const batsThrows = stripTags(row[3]);
      if (!name || name.includes("없습니다")) continue;
      const key = `${group}:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      players.push({
        name: name.slice(0, 40),
        position: group,
        jerseyNumber: jerseyNumber.slice(0, 4),
        batsThrows: batsThrows.slice(0, 20),
      });
    }
  }

  return players;
}

async function requestRegister(
  cookie: string,
  body?: URLSearchParams,
): Promise<{ html: string; cookie: string }> {
  const res = await fetch(REGISTER_URL, {
    method: body ? "POST" : "GET",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
      ...(body
        ? {
            "Content-Type": "application/x-www-form-urlencoded",
            Origin: "https://www.koreabaseball.com",
            Referer: REGISTER_URL,
          }
        : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body?.toString(),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    throw new Error(`KBO 등록 페이지 응답 ${res.status}`);
  }
  const html = await res.text();
  const nextCookie = mergeCookies(cookie, res.headers.getSetCookie?.() ?? []);
  return { html, cookie: nextCookie };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchKboRegisterRosters(
  teams: KboTeamShort[],
): Promise<{
  rosters: Map<KboTeamShort, KboRegisterPlayer[]>;
  errors: Map<KboTeamShort, string>;
}> {
  const unique = [...new Set(teams)];
  const rosters = new Map<KboTeamShort, KboRegisterPlayer[]>();
  const errors = new Map<KboTeamShort, string>();
  if (unique.length === 0) return { rosters, errors };

  let { html, cookie } = await requestRegister("");
  let state = parseAspNetState(html);

  for (let i = 0; i < unique.length; i++) {
    const team = unique[i];
    const code = KBO_REGISTER_TEAM_CODES[team];
    if (!code) {
      errors.set(team, `${team} 구단 코드를 찾지 못했습니다.`);
      continue;
    }

    if (i > 0) await sleep(400);

    try {
      const body = new URLSearchParams({
        __EVENTTARGET: CALENDAR_TARGET,
        __EVENTARGUMENT: "",
        __VIEWSTATE: state.viewState,
        __VIEWSTATEGENERATOR: state.viewStateGenerator,
        __EVENTVALIDATION: state.eventValidation,
        [TEAM_FIELD]: code,
        [DATE_FIELD]: state.searchDate,
      });
      const posted = await requestRegister(cookie, body);
      html = posted.html;
      cookie = posted.cookie;
      state = parseAspNetState(html);

      const selected = extractInputValue(html, TEAM_FIELD);
      if (selected && selected !== code) {
        throw new Error(`${team} 구단 페이지로 전환하지 못했습니다.`);
      }

      const players = parseKboRegisterHtml(html);
      if (players.length === 0) {
        throw new Error(`${team} 1군 등록 선수를 읽지 못했습니다.`);
      }
      rosters.set(team, players);
    } catch (error) {
      errors.set(team, error instanceof Error ? error.message : "가져오기에 실패했습니다.");
      try {
        const reset = await requestRegister("");
        html = reset.html;
        cookie = reset.cookie;
        state = parseAspNetState(html);
      } catch {
        // keep previous state; next team may still work
      }
    }
  }

  return { rosters, errors };
}
