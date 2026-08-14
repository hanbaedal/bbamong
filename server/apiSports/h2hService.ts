import type { MatchHeadToHeadSnapshot } from "@shared/apiSportsTypes";
import { MatchModel } from "../UserStorage/db";
import { getKstDateString } from "../utils/dateUtils";
import { resolveApiSportsSeason } from "./constants";
import { resolveMatchTeamShort } from "../kboRoster/kboRosterService";
import {
  fetchDaumKboGameList,
  findDaumGameForMatch,
} from "../daumLive/daumHermesClient";
import { fetchNaverSeasonHeadToHead } from "../daumLive/naverRelayClient";

const H2H_REFRESH_MS = Math.max(
  60_000,
  parseInt(process.env.H2H_REFRESH_MS || process.env.API_SPORTS_H2H_REFRESH_MS || String(24 * 60 * 60 * 1000), 10) ||
    24 * 60 * 60 * 1000,
);

const h2hInFlight = new Set<string>();
const h2hAttemptAt = new Map<string, number>();

type MatchH2hRow = {
  id: string;
  matchDate?: string | null;
  startTime?: Date;
  registrationOrder?: number | null;
  daumGameId?: number | null;
  apiSportsHomeTeam?: string | null;
  apiSportsAwayTeam?: string | null;
  liveScoreboard?: { homeTeamName?: string | null; awayTeamName?: string | null } | null;
  matchHeadToHead?: MatchHeadToHeadSnapshot | null;
};

function headToHeadIsStale(snapshot?: MatchHeadToHeadSnapshot | null, season?: number): boolean {
  if (!snapshot?.syncedAt) return true;
  if (season != null && snapshot.season !== season) return true;
  return Date.now() - new Date(snapshot.syncedAt).getTime() >= H2H_REFRESH_MS;
}

function dateKeyForMatch(match: MatchH2hRow): string {
  if (match.matchDate && /^\d{4}-\d{2}-\d{2}$/.test(match.matchDate)) return match.matchDate;
  if (match.startTime) return getKstDateString(match.startTime);
  return getKstDateString();
}

export async function refreshMatchHeadToHeadIfDue(
  matchId: string,
  prefetched?: MatchH2hRow | null,
): Promise<MatchHeadToHeadSnapshot | null> {
  if (h2hInFlight.has(matchId)) return prefetched?.matchHeadToHead ?? null;

  h2hInFlight.add(matchId);
  try {
    const match =
      prefetched ??
      ((await MatchModel.findOne({ id: matchId })
        .select(
          "id matchDate startTime registrationOrder daumGameId apiSportsHomeTeam apiSportsAwayTeam liveScoreboard matchHeadToHead",
        )
        .lean()) as MatchH2hRow | null);

    if (!match) return null;

    const season = resolveApiSportsSeason(match.startTime);
    if (!headToHeadIsStale(match.matchHeadToHead, season)) {
      return match.matchHeadToHead ?? null;
    }

    const lastAttempt = h2hAttemptAt.get(matchId);
    if (lastAttempt != null && Date.now() - lastAttempt < H2H_REFRESH_MS) {
      return match.matchHeadToHead ?? null;
    }
    h2hAttemptAt.set(matchId, Date.now());

    const dateYmd = dateKeyForMatch(match).replace(/-/g, "");
    const games = await fetchDaumKboGameList(dateYmd);
    const found = findDaumGameForMatch(games, {
      daumGameId: match.daumGameId ?? null,
      homeTeam: resolveMatchTeamShort(match, "home"),
      awayTeam: resolveMatchTeamShort(match, "away"),
    });
    if (!found?.cpGameId) return match.matchHeadToHead ?? null;

    const vs = await fetchNaverSeasonHeadToHead(found.cpGameId);
    if (!vs) return match.matchHeadToHead ?? null;

    const snapshot: MatchHeadToHeadSnapshot = {
      awayWins: vs.awayWins,
      homeWins: vs.homeWins,
      season,
      syncedAt: new Date().toISOString(),
    };
    await MatchModel.updateOne({ id: matchId }, { matchHeadToHead: snapshot });
    return snapshot;
  } catch (error) {
    console.warn(`[H2H] daum/naver ${matchId}:`, error);
    return prefetched?.matchHeadToHead ?? null;
  } finally {
    h2hInFlight.delete(matchId);
  }
}
