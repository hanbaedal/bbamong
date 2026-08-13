import type { MatchHeadToHeadSnapshot } from "@shared/apiSportsTypes";
import { MatchModel } from "../UserStorage/db";
import { isMatchApiSportsPollingEnabled } from "../managerOperatorService";
import { apiSportsTeamIdsFromGame, fetchGameById, fetchHeadToHeadGames } from "./client";
import { KBO_LEAGUE_ID, resolveApiSportsSeason } from "./constants";
import { computeHeadToHeadRecord } from "./h2hParser";

const H2H_REFRESH_MS = Math.max(
  60_000,
  parseInt(process.env.API_SPORTS_H2H_REFRESH_MS || String(24 * 60 * 60 * 1000), 10) ||
    24 * 60 * 60 * 1000,
);

const h2hInFlight = new Set<string>();
const h2hAttemptAt = new Map<string, number>();

type MatchH2hRow = {
  id: string;
  registrationOrder?: number | null;
  startTime?: Date;
  apiSportsGameId?: number | null;
  apiSportsAwayTeamId?: number | null;
  apiSportsHomeTeamId?: number | null;
  matchHeadToHead?: MatchHeadToHeadSnapshot | null;
};

function headToHeadIsStale(snapshot?: MatchHeadToHeadSnapshot | null, season?: number): boolean {
  if (!snapshot?.syncedAt) return true;
  if (season != null && snapshot.season !== season) return true;
  return Date.now() - new Date(snapshot.syncedAt).getTime() >= H2H_REFRESH_MS;
}

export async function refreshMatchHeadToHeadIfDue(
  matchId: string,
  prefetched?: MatchH2hRow | null,
): Promise<MatchHeadToHeadSnapshot | null> {
  if (!process.env.API_SPORTS_KEY?.trim()) return null;
  if (h2hInFlight.has(matchId)) return prefetched?.matchHeadToHead ?? null;

  h2hInFlight.add(matchId);
  try {
    const match =
      prefetched ??
      ((await MatchModel.findOne({ id: matchId })
        .select(
          "id registrationOrder startTime apiSportsGameId apiSportsAwayTeamId apiSportsHomeTeamId matchHeadToHead",
        )
        .lean()) as MatchH2hRow | null);

    if (!match) return null;
    if (!(await isMatchApiSportsPollingEnabled(match.registrationOrder))) return match.matchHeadToHead ?? null;

    let awayTeamId = match.apiSportsAwayTeamId ?? null;
    let homeTeamId = match.apiSportsHomeTeamId ?? null;
    const season = resolveApiSportsSeason(match.startTime);
    const needsTeamIds = !awayTeamId || !homeTeamId;
    if (!needsTeamIds && !headToHeadIsStale(match.matchHeadToHead, season)) {
      return match.matchHeadToHead ?? null;
    }

    const lastAttempt = h2hAttemptAt.get(matchId);
    if (lastAttempt != null && Date.now() - lastAttempt < H2H_REFRESH_MS) {
      return match.matchHeadToHead ?? null;
    }
    h2hAttemptAt.set(matchId, Date.now());

    if (needsTeamIds && match.apiSportsGameId) {
      const game = await fetchGameById(match.apiSportsGameId);
      if (game) {
        awayTeamId = game.teams.away.id;
        homeTeamId = game.teams.home.id;
        await MatchModel.updateOne({ id: matchId }, apiSportsTeamIdsFromGame(game));
      }
    }

    if (!awayTeamId || !homeTeamId) return match.matchHeadToHead ?? null;
    if (!headToHeadIsStale(match.matchHeadToHead, season)) {
      return match.matchHeadToHead ?? null;
    }

    const games = await fetchHeadToHeadGames(
      awayTeamId,
      homeTeamId,
      season,
      KBO_LEAGUE_ID,
    );
    if (!games) return match.matchHeadToHead ?? null;

    const { awayWins, homeWins } = computeHeadToHeadRecord(
      games,
      awayTeamId,
      homeTeamId,
    );

    const snapshot: MatchHeadToHeadSnapshot = {
      awayWins,
      homeWins,
      season,
      syncedAt: new Date().toISOString(),
    };

    await MatchModel.updateOne({ id: matchId }, { matchHeadToHead: snapshot });
    return snapshot;
  } finally {
    h2hInFlight.delete(matchId);
  }
}
