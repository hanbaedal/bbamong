import { mapApiPositionToKbo } from "@shared/kboRoster";
import { formatBattingAverage } from "@shared/batterDisplay";
import type { TodayLineupBatter, TodayLineupGame, TodayLineupSide } from "@shared/todayStartingLineup";
import {
  DAUM_USER_AGENT,
  daumTeamName,
  daumTeamShort,
  fetchDaumKboGameList,
  type DaumTeamBlock,
} from "../daumLive/daumHermesClient";

const NAVER_GAME_BASE = "https://api-gw.sports.naver.com/schedule/games";
const FETCH_TIMEOUT_MS = 20_000;

type NaverBatter = {
  batOrder?: number;
  name?: string;
  pos?: string;
  hra?: string | number;
  playerCode?: string | number;
};

type NaverPreviewPlayer = {
  playerName?: string;
  positionName?: string;
  playerCode?: string | number;
};

function compactName(name: string): string {
  return name.replace(/\s+/g, "").replace(/[·･•]/g, "").trim();
}

async function fetchJson(url: string, referer: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": DAUM_USER_AGENT,
      Accept: "application/json",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
      Referer: referer,
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

function formatStartTime(raw?: string): string {
  const digits = (raw ?? "").replace(/\D/g, "").padStart(4, "0").slice(0, 4);
  if (digits.length !== 4) return "";
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

function teamFromDaum(block?: DaumTeamBlock): { teamShort: string; teamName: string } {
  const teamShort = daumTeamShort(block);
  return { teamShort, teamName: daumTeamName(block) || teamShort };
}

function toBatter(input: {
  battingOrder: number;
  name: string;
  positionRaw: string;
  battingAverage?: string | number | null;
  playerCode?: string | number;
}): TodayLineupBatter | null {
  const name = compactName(input.name);
  if (!name) return null;
  const order = Math.round(Number(input.battingOrder));
  if (!Number.isFinite(order) || order < 1 || order > 9) return null;
  return {
    battingOrder: order,
    name: name.slice(0, 40),
    position: mapApiPositionToKbo(input.positionRaw),
    positionRaw: (input.positionRaw ?? "").trim(),
    battingAverage: formatBattingAverage(input.battingAverage ?? null),
    ...(input.playerCode != null && String(input.playerCode).trim()
      ? { playerCode: String(input.playerCode).trim() }
      : {}),
    rosterMatch: "unmatched",
  };
}

function startersFromBoxscore(rows: NaverBatter[] | undefined): TodayLineupBatter[] {
  const byOrder = new Map<number, TodayLineupBatter>();
  for (const row of rows ?? []) {
    const pos = (row.pos ?? "").trim();
    if (pos === "대" || pos.includes("대타")) continue;
    const batter = toBatter({
      battingOrder: Number(row.batOrder),
      name: row.name ?? "",
      positionRaw: pos,
      battingAverage: row.hra,
      playerCode: row.playerCode,
    });
    if (!batter || byOrder.has(batter.battingOrder)) continue;
    byOrder.set(batter.battingOrder, batter);
  }
  return [...byOrder.values()].sort((a, b) => a.battingOrder - b.battingOrder);
}

function startersFromPreview(fullLineUp: NaverPreviewPlayer[] | undefined): TodayLineupBatter[] {
  const batters: TodayLineupBatter[] = [];
  for (const row of fullLineUp ?? []) {
    const pos = (row.positionName ?? "").trim();
    if (!pos || pos.includes("투수")) continue;
    const batter = toBatter({
      battingOrder: batters.length + 1,
      name: row.playerName ?? "",
      positionRaw: pos,
      playerCode: row.playerCode,
    });
    if (!batter) continue;
    batters.push(batter);
    if (batters.length >= 9) break;
  }
  return batters;
}

function parseNaverRecord(payload: unknown): { home: NaverBatter[]; away: NaverBatter[] } {
  const record =
    payload && typeof payload === "object"
      ? ((payload as { result?: { recordData?: { battersBoxscore?: { home?: NaverBatter[]; away?: NaverBatter[] } } } })
          .result?.recordData?.battersBoxscore ?? null)
      : null;
  return {
    home: Array.isArray(record?.home) ? record.home : [],
    away: Array.isArray(record?.away) ? record.away : [],
  };
}

function parseNaverPreview(payload: unknown): {
  home: NaverPreviewPlayer[];
  away: NaverPreviewPlayer[];
} {
  const preview =
    payload && typeof payload === "object"
      ? ((payload as {
          result?: {
            previewData?: {
              homeTeamLineUp?: { fullLineUp?: NaverPreviewPlayer[] };
              awayTeamLineUp?: { fullLineUp?: NaverPreviewPlayer[] };
            };
          };
        }).result?.previewData ?? null)
      : null;
  return {
    home: Array.isArray(preview?.homeTeamLineUp?.fullLineUp) ? preview.homeTeamLineUp.fullLineUp : [],
    away: Array.isArray(preview?.awayTeamLineUp?.fullLineUp) ? preview.awayTeamLineUp.fullLineUp : [],
  };
}

function sideFromSources(input: {
  teamShort: string;
  teamName: string;
  boxscore: NaverBatter[];
  preview: NaverPreviewPlayer[];
}): TodayLineupSide {
  const fromBox = startersFromBoxscore(input.boxscore);
  if (fromBox.length >= 9) {
    return { teamShort: input.teamShort, teamName: input.teamName, batters: fromBox, source: "boxscore" };
  }
  const fromPreview = startersFromPreview(input.preview);
  if (fromPreview.length >= 9) {
    return { teamShort: input.teamShort, teamName: input.teamName, batters: fromPreview, source: "preview" };
  }
  if (fromBox.length > 0) {
    return { teamShort: input.teamShort, teamName: input.teamName, batters: fromBox, source: "boxscore" };
  }
  if (fromPreview.length > 0) {
    return { teamShort: input.teamShort, teamName: input.teamName, batters: fromPreview, source: "preview" };
  }
  return { teamShort: input.teamShort, teamName: input.teamName, batters: [], source: "none" };
}

async function fetchNaverSides(naverGameId: string): Promise<{
  homeBox: NaverBatter[];
  awayBox: NaverBatter[];
  homePreview: NaverPreviewPlayer[];
  awayPreview: NaverPreviewPlayer[];
}> {
  const recordUrl = `${NAVER_GAME_BASE}/${encodeURIComponent(naverGameId)}/record`;
  const previewUrl = `${NAVER_GAME_BASE}/${encodeURIComponent(naverGameId)}/preview`;
  const [recordResult, previewResult] = await Promise.allSettled([
    fetchJson(recordUrl, "https://m.sports.naver.com/"),
    fetchJson(previewUrl, "https://m.sports.naver.com/"),
  ]);
  const record =
    recordResult.status === "fulfilled"
      ? parseNaverRecord(recordResult.value)
      : { home: [], away: [] };
  const preview =
    previewResult.status === "fulfilled"
      ? parseNaverPreview(previewResult.value)
      : { home: [], away: [] };
  if (recordResult.status === "rejected" && previewResult.status === "rejected") {
    throw new Error("타순 JSON을 불러오지 못했습니다.");
  }
  return {
    homeBox: record.home,
    awayBox: record.away,
    homePreview: preview.home,
    awayPreview: preview.away,
  };
}

export async function fetchDaumKboGames(dateYmd: string) {
  return fetchDaumKboGameList(dateYmd);
}

export async function fetchTodayStartingLineupGames(dateKey: string): Promise<TodayLineupGame[]> {
  const dateYmd = dateKey.replace(/-/g, "");
  if (!/^\d{8}$/.test(dateYmd)) {
    throw new Error("날짜 형식이 올바르지 않습니다.");
  }

  const daumGames = await fetchDaumKboGames(dateYmd);
  const games = await Promise.all(
    daumGames.map(async (game): Promise<TodayLineupGame> => {
      const daumGameId = Number(game.gameId);
      const naverGameId = String(game.cpGameId ?? "").replace(/\|/g, "");
      const homeTeam = teamFromDaum(game.home);
      const awayTeam = teamFromDaum(game.away);
      const base: TodayLineupGame = {
        daumGameId,
        naverGameId,
        gameUrl: game.gameUrl?.trim() || `https://sports.daum.net/match/${daumGameId}`,
        startTime: formatStartTime(game.startTime),
        gameStatus: String(game.gameStatus ?? ""),
        home: { ...homeTeam, batters: [], source: "none" },
        away: { ...awayTeam, batters: [], source: "none" },
        ppamongMatchId: null,
        registrationOrder: null,
        ppamongMatchName: null,
        alreadyApplied: false,
        operatorLineupLocked: false,
        ppamongMatchStatus: null,
      };
      if (!naverGameId) {
        return { ...base, fetchError: "네이버 경기 ID가 없습니다." };
      }
      try {
        const sides = await fetchNaverSides(naverGameId);
        return {
          ...base,
          home: sideFromSources({
            ...homeTeam,
            boxscore: sides.homeBox,
            preview: sides.homePreview,
          }),
          away: sideFromSources({
            ...awayTeam,
            boxscore: sides.awayBox,
            preview: sides.awayPreview,
          }),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "타순을 불러오지 못했습니다.";
        return { ...base, fetchError: message };
      }
    }),
  );

  return games.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.daumGameId - b.daumGameId);
}
