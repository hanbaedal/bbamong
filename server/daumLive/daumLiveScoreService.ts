import { MatchModel } from "../UserStorage/db";
import { getKstDateString } from "../utils/dateUtils";
import { resolveMatchTeamShort } from "../kboRoster/kboRosterService";
import { fetchDaumKboGameList, findDaumGameForMatch } from "./daumHermesClient";
import { parseDaumLiveScoreboard } from "./parseDaumLiveScoreboard";
import type { LiveScoreboard } from "@shared/apiSportsTypes";

type MatchForDaum = {
  id: string;
  matchDate?: string | null;
  startTime?: Date | null;
  daumGameId?: number | null;
  apiSportsHomeTeam?: string | null;
  apiSportsAwayTeam?: string | null;
  liveScoreboard?: { homeTeamName?: string | null; awayTeamName?: string | null } | null;
};

function dateKeyForMatch(match: MatchForDaum): string {
  if (match.matchDate && /^\d{4}-\d{2}-\d{2}$/.test(match.matchDate)) return match.matchDate;
  if (match.startTime) return getKstDateString(match.startTime);
  return getKstDateString();
}

export async function resolveDaumLiveScoreboard(match: MatchForDaum): Promise<{
  daumGameId: number;
  scoreboard: LiveScoreboard;
} | null> {
  const dateYmd = dateKeyForMatch(match).replace(/-/g, "");
  const games = await fetchDaumKboGameList(dateYmd);
  const found = findDaumGameForMatch(games, {
    daumGameId: match.daumGameId ?? null,
    homeTeam: resolveMatchTeamShort(match, "home"),
    awayTeam: resolveMatchTeamShort(match, "away"),
  });
  if (!found?.gameId) return null;
  return {
    daumGameId: Number(found.gameId),
    scoreboard: parseDaumLiveScoreboard(found),
  };
}

export async function persistMatchDaumGameId(matchId: string, daumGameId: number): Promise<void> {
  if (!Number.isFinite(daumGameId) || daumGameId <= 0) return;
  await MatchModel.updateOne({ id: matchId }, { daumGameId });
}
