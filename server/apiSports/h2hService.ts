import type { MatchHeadToHeadSnapshot } from "@shared/apiSportsTypes";
import { MatchModel } from "../UserStorage/db";
import { fetchHeadToHeadGames } from "./client";
import { KBO_LEAGUE_ID, resolveApiSportsSeason } from "./constants";
import { computeHeadToHeadRecord } from "./h2hParser";

const H2H_REFRESH_MS = Math.max(
  60_000,
  parseInt(process.env.API_SPORTS_H2H_REFRESH_MS || String(24 * 60 * 60 * 1000), 10) ||
    24 * 60 * 60 * 1000,
);

type MatchH2hRow = {
  id: string;
  startTime?: Date;
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

  const match =
    prefetched ??
    ((await MatchModel.findOne({ id: matchId })
      .select("id startTime apiSportsAwayTeamId apiSportsHomeTeamId matchHeadToHead")
      .lean()) as MatchH2hRow | null);

  if (!match?.apiSportsAwayTeamId || !match?.apiSportsHomeTeamId) return null;

  const season = resolveApiSportsSeason(match.startTime);
  if (!headToHeadIsStale(match.matchHeadToHead, season)) {
    return match.matchHeadToHead ?? null;
  }

  const games = await fetchHeadToHeadGames(
    match.apiSportsAwayTeamId,
    match.apiSportsHomeTeamId,
    season,
    KBO_LEAGUE_ID,
  );
  if (!games) return match.matchHeadToHead ?? null;

  const { awayWins, homeWins } = computeHeadToHeadRecord(
    games,
    match.apiSportsAwayTeamId,
    match.apiSportsHomeTeamId,
  );

  const snapshot: MatchHeadToHeadSnapshot = {
    awayWins,
    homeWins,
    season,
    syncedAt: new Date().toISOString(),
  };

  await MatchModel.updateOne({ id: matchId }, { matchHeadToHead: snapshot });
  return snapshot;
}
