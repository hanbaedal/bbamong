import type { ManualBatterInput } from "../apiSports/manualLineupService";
import { saveManualMatchLineup } from "../apiSports/manualLineupService";
import { listKboPlayers, resolveMatchTeamShort } from "../kboRoster/kboRosterService";
import { MatchModel } from "../UserStorage/db";
import { getKstDateString, getKstDayRange } from "../utils/dateUtils";
import { fetchTodayStartingLineupGames } from "./fetchTodayStartingLineups";
import { persistMatchDaumGameId } from "../daumLive/daumLiveScoreService";
import type {
  TodayLineupApplyResult,
  TodayLineupBatter,
  TodayLineupGame,
  TodayLineupMatchStatus,
} from "@shared/todayStartingLineup";
import { isKboTeamShort, resolveKboTeamShortName, type KboTeamShort } from "@shared/kboHomeStadium";

type LeanMatch = {
  id: string;
  name?: string;
  registrationOrder?: number | null;
  matchStatus?: string | null;
  apiSportsHomeTeam?: string | null;
  apiSportsAwayTeam?: string | null;
  liveScoreboard?: { homeTeamName?: string | null; awayTeamName?: string | null } | null;
  matchLineup?: { source?: string; home?: unknown[]; away?: unknown[] } | null;
  startTime?: Date;
};

function normalizeDateKey(raw?: string | null): string {
  const trimmed = (raw ?? "").trim();
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return getKstDateString();
}

function normalizePlayerName(name: string): string {
  return name.replace(/\s+/g, "").replace(/[·･•]/g, "").trim();
}

function kstMinutes(date?: Date | null): number | null {
  if (!date) return null;
  const hm = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const [hh, mm] = hm.split(":").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function matchTeamPair(match: LeanMatch): { home: string | null; away: string | null } {
  return {
    home: resolveMatchTeamShort(match, "home"),
    away: resolveMatchTeamShort(match, "away"),
  };
}

async function loadDayMatches(dateKey: string): Promise<LeanMatch[]> {
  const { start, end } = getKstDayRange(new Date(`${dateKey}T12:00:00+09:00`));
  const docs = await MatchModel.find({
    $or: [{ matchDate: dateKey }, { matchDate: null, startTime: { $gte: start, $lte: end } }],
  })
    .select(
      "id name registrationOrder matchStatus apiSportsHomeTeam apiSportsAwayTeam liveScoreboard matchLineup startTime",
    )
    .sort({ registrationOrder: 1, startTime: 1 })
    .lean();
  return docs as LeanMatch[];
}

function attachPpamongMatch(game: TodayLineupGame, matches: LeanMatch[]): TodayLineupGame {
  const home = resolveKboTeamShortName(game.home.teamShort) ?? game.home.teamShort;
  const away = resolveKboTeamShortName(game.away.teamShort) ?? game.away.teamShort;
  const candidates = matches.filter((match) => {
    const pair = matchTeamPair(match);
    return pair.home === home && pair.away === away;
  });
  if (candidates.length === 0) {
    return {
      ...game,
      ppamongMatchId: null,
      registrationOrder: null,
      ppamongMatchName: null,
      alreadyApplied: false,
      operatorLineupLocked: false,
      ppamongMatchStatus: null,
    };
  }

  const gameMinutes = game.startTime
    ? Number.parseInt(game.startTime.slice(0, 2), 10) * 60 + Number.parseInt(game.startTime.slice(3, 5), 10)
    : null;
  const picked =
    candidates.length === 1 || gameMinutes == null
      ? candidates[0]
      : candidates
          .slice()
          .sort((a, b) => {
            const aMin = kstMinutes(a.startTime) ?? Number.POSITIVE_INFINITY;
            const bMin = kstMinutes(b.startTime) ?? Number.POSITIVE_INFINITY;
            return Math.abs(aMin - gameMinutes) - Math.abs(bMin - gameMinutes);
          })[0];

  const lineup = picked.matchLineup;
  const homeCount = lineup?.home?.length ?? 0;
  const awayCount = lineup?.away?.length ?? 0;
  const alreadyApplied =
    (lineup?.source === "manual" || lineup?.source === "today-lineup") &&
    homeCount >= 9 &&
    awayCount >= 9;
  const operatorLineupLocked = lineup?.source === "manual" && (homeCount > 0 || awayCount > 0);

  return {
    ...game,
    ppamongMatchId: picked.id,
    registrationOrder: picked.registrationOrder ?? null,
    ppamongMatchName: picked.name ?? null,
    alreadyApplied,
    operatorLineupLocked,
    ppamongMatchStatus: picked.matchStatus ?? null,
  };
}

async function matchRosterBatters(
  teamShort: string,
  season: number,
  batters: TodayLineupBatter[],
): Promise<TodayLineupBatter[]> {
  if (!isKboTeamShort(teamShort) || batters.length === 0) {
    return batters.map((batter) => ({ ...batter, rosterMatch: "unmatched" as const, rosterPlayerId: undefined }));
  }
  const roster = await listKboPlayers({ team: teamShort as KboTeamShort, season, activeOnly: true });
  const byName = new Map<string, typeof roster>();
  for (const player of roster) {
    const key = normalizePlayerName(player.name);
    const list = byName.get(key) ?? [];
    list.push(player);
    byName.set(key, list);
  }
  return batters.map((batter) => {
    const hits = byName.get(normalizePlayerName(batter.name)) ?? [];
    let rosterMatch: TodayLineupMatchStatus = "unmatched";
    let rosterPlayerId: string | undefined;
    if (hits.length === 1) {
      rosterMatch = "matched";
      rosterPlayerId = hits[0].id;
    } else if (hits.length > 1) {
      rosterMatch = "ambiguous";
    }
    return { ...batter, rosterMatch, rosterPlayerId };
  });
}

async function hydrateGameRoster(game: TodayLineupGame, season: number): Promise<TodayLineupGame> {
  const [home, away] = await Promise.all([
    matchRosterBatters(game.home.teamShort, season, game.home.batters),
    matchRosterBatters(game.away.teamShort, season, game.away.batters),
  ]);
  return {
    ...game,
    home: { ...game.home, batters: home },
    away: { ...game.away, batters: away },
  };
}

export async function getTodayStartingLineups(dateRaw?: string | null): Promise<{
  date: string;
  games: TodayLineupGame[];
}> {
  const date = normalizeDateKey(dateRaw);
  const season = Number.parseInt(date.slice(0, 4), 10);
  const [fetched, matches] = await Promise.all([
    fetchTodayStartingLineupGames(date),
    loadDayMatches(date),
  ]);
  const attached = fetched.map((game) => attachPpamongMatch(game, matches));
  const games = await Promise.all(attached.map((game) => hydrateGameRoster(game, season)));
  return { date, games };
}

function toManualBatters(batters: TodayLineupBatter[]): ManualBatterInput[] {
  return batters
    .filter((batter) => batter.name.trim())
    .map((batter) => ({
      battingOrder: batter.battingOrder,
      name: batter.name,
      ...(batter.rosterPlayerId && batter.rosterMatch === "matched"
        ? { rosterPlayerId: batter.rosterPlayerId }
        : {}),
      battingAverage: batter.battingAverage,
      position: batter.position,
    }));
}

async function applyLineupGames(games: TodayLineupGame[]): Promise<TodayLineupApplyResult[]> {
  const results: TodayLineupApplyResult[] = [];
  for (const game of games) {
    const unmatchedNames = [
      ...game.home.batters.filter((b) => b.rosterMatch !== "matched").map((b) => `${game.home.teamShort} ${b.name}`),
      ...game.away.batters.filter((b) => b.rosterMatch !== "matched").map((b) => `${game.away.teamShort} ${b.name}`),
    ];
    if (!game.ppamongMatchId) {
      results.push({
        daumGameId: game.daumGameId,
        matchId: null,
        applied: false,
        homeCount: game.home.batters.length,
        awayCount: game.away.batters.length,
        unmatchedNames,
        error: "빠몽 경기가 없습니다.",
      });
      continue;
    }
    const home = toManualBatters(game.home.batters);
    const away = toManualBatters(game.away.batters);
    if (home.length === 0 && away.length === 0) {
      results.push({
        daumGameId: game.daumGameId,
        matchId: game.ppamongMatchId,
        applied: false,
        homeCount: 0,
        awayCount: 0,
        unmatchedNames,
        error: "선발 타순이 아직 없습니다.",
      });
      continue;
    }
    try {
      const side = home.length === 0 ? "away" : away.length === 0 ? "home" : undefined;
      await saveManualMatchLineup(game.ppamongMatchId, {
        home,
        away,
        side,
        source: "today-lineup",
      });
      await persistMatchDaumGameId(game.ppamongMatchId, game.daumGameId);
      const { refreshMatchSeasonContext } = await import("../daumLive/daumSeasonStatsService");
      await refreshMatchSeasonContext(game.ppamongMatchId, { force: true }).catch((error) => {
        console.warn(`[TodayLineup] season stats ${game.ppamongMatchId}:`, error);
      });
      results.push({
        daumGameId: game.daumGameId,
        matchId: game.ppamongMatchId,
        applied: true,
        homeCount: home.length,
        awayCount: away.length,
        unmatchedNames,
      });
    } catch (error) {
      results.push({
        daumGameId: game.daumGameId,
        matchId: game.ppamongMatchId,
        applied: false,
        homeCount: home.length,
        awayCount: away.length,
        unmatchedNames,
        error: error instanceof Error ? error.message : "타순 저장에 실패했습니다.",
      });
    }
  }

  return results;
}

export async function applyTodayStartingLineups(input: {
  date?: string | null;
  matchId?: string | null;
  daumGameId?: number | null;
}): Promise<{ date: string; results: TodayLineupApplyResult[] }> {
  const { date, games } = await getTodayStartingLineups(input.date);
  const target = games.filter((game) => {
    if (input.matchId) return game.ppamongMatchId === input.matchId;
    if (input.daumGameId != null) return game.daumGameId === input.daumGameId;
    return true;
  });
  return { date, results: await applyLineupGames(target) };
}

function isClosedMatchStatus(status?: string | null): boolean {
  return status === "completed" || status === "cancelled";
}

/**
 * 양팀 선발 9명이 공개된 경기만 운영자 타순에 넣는다.
 * 운영자가 직접 넣은 타순(source=manual)은 덮지 않는다.
 */
export async function applyReadyTodayStartingLineups(dateRaw?: string | null): Promise<{
  date: string;
  results: TodayLineupApplyResult[];
}> {
  const { date, games } = await getTodayStartingLineups(dateRaw);
  const ready = games.filter((game) => {
    if (!game.ppamongMatchId) return false;
    if (game.alreadyApplied || game.operatorLineupLocked) return false;
    if (isClosedMatchStatus(game.ppamongMatchStatus)) return false;
    return game.home.batters.length >= 9 && game.away.batters.length >= 9;
  });
  return { date, results: await applyLineupGames(ready) };
}
