import type { ApiSportsGameResponse } from "./client";
import type { MatchHeadToHeadRecord } from "@shared/matchTeamDisplay";
import { isGameFinished, isGamePostponedOrCancelled } from "./scoreboardParser";

function gameTotalScore(side?: { total?: number; innings?: Record<string, number | null> }): number {
  if (!side) return 0;
  if (typeof side.total === "number" && Number.isFinite(side.total)) return side.total;
  if (!side.innings) return 0;
  return Object.values(side.innings).reduce<number>(
    (sum, runs) => sum + (typeof runs === "number" ? runs : 0),
    0,
  );
}

/** h2h 경기 목록 → 현재 경기 원정/홈 팀 ID 기준 승-패 */
export function computeHeadToHeadRecord(
  games: ApiSportsGameResponse[],
  awayTeamId: number,
  homeTeamId: number,
): MatchHeadToHeadRecord {
  let awayWins = 0;
  let homeWins = 0;

  for (const game of games) {
    const statusShort = game.status?.short ?? "";
    if (!isGameFinished(statusShort) || isGamePostponedOrCancelled(statusShort)) continue;

    const gameAwayId = game.teams.away.id;
    const gameHomeId = game.teams.home.id;
    const awayScore = gameTotalScore(game.scores?.away);
    const homeScore = gameTotalScore(game.scores?.home);
    if (awayScore === homeScore) continue;

    const winnerId = homeScore > awayScore ? gameHomeId : gameAwayId;
    if (winnerId === awayTeamId) awayWins += 1;
    else if (winnerId === homeTeamId) homeWins += 1;
  }

  return { awayWins, homeWins };
}
