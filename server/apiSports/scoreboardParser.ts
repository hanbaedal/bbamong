import type { LiveScoreboard } from "@shared/apiSportsTypes";
import {
  formatInningWithHalf,
  type InningHalf,
} from "@shared/gamePhaseTypes";
import {
  apiStatusDisplayLabel,
  isGameFinished,
  isGameNotStarted,
  isGamePostponedOrCancelled,
} from "@shared/apiSportsStatus";
import {
  inferCurrentInningFromRuns,
  inferInningHalfFromRuns,
} from "@shared/matchPhaseDisplay";
import type { ApiSportsGameResponse } from "./client";

export {
  isGameFinished,
  isGameLiveStatus,
  isGameNotStarted,
  isGamePostponedOrCancelled,
  apiStatusDisplayLabel,
} from "@shared/apiSportsStatus";

/** API-SPORTS status에서 공수(초/말) 추출 — Top/Bottom, T8/B8 등 */
export function parseInningHalfFromApiStatus(
  statusShort: string,
  statusLong: string,
): InningHalf | null {
  const short = statusShort.toUpperCase();
  const long = statusLong.toLowerCase();

  if (/\btop\b|\btop of\b|\(top\)|\bt\b inning/.test(long)) return "top";
  if (/\bbottom\b|\bbottom of\b|\(bottom\)|\bbot\b/.test(long)) return "bottom";

  if (/^T\d|^IN\d+T|TOP\d|^\d+T$/.test(short)) return "top";
  if (/^B\d|^IN\d+B|BOT\d|^\d+B$/.test(short)) return "bottom";

  return null;
}

function parseInningNumber(statusShort: string, statusLong: string): number | null {
  const short = statusShort.toUpperCase();
  const inningMatch = short.match(/^IN(\d+)/);
  if (inningMatch) return Number(inningMatch[1]);

  const longMatch =
    statusLong.match(/(\d+)(?:st|nd|rd|th)\s+inning/i) ||
    statusLong.match(/inning\s*(\d+)/i);
  if (longMatch) return Number(longMatch[1]);

  const shortHalfMatch = short.match(/^[TB](\d+)$/);
  if (shortHalfMatch) return Number(shortHalfMatch[1]);

  return null;
}

function parseInningFromStatus(
  statusShort: string,
  statusLong: string,
): { inning: number | null; inningHalf: InningHalf | null; label: string } {
  const short = statusShort.toUpperCase();
  const specialLabel = apiStatusDisplayLabel(statusShort, statusLong);
  if (specialLabel && (isGameFinished(short) || isGamePostponedOrCancelled(short) || isGameNotStarted(short))) {
    return { inning: null, inningHalf: null, label: specialLabel };
  }

  const inning = parseInningNumber(statusShort, statusLong);
  const inningHalf = parseInningHalfFromApiStatus(statusShort, statusLong);

  if (inning != null && inningHalf) {
    return {
      inning,
      inningHalf,
      label: formatInningWithHalf(inning, inningHalf),
    };
  }
  if (inning != null) {
    return { inning, inningHalf: null, label: `${inning}회` };
  }
  if (specialLabel) return { inning: null, inningHalf: null, label: specialLabel };
  return { inning: null, inningHalf: null, label: statusShort || "진행 중" };
}

function sumInningRuns(innings?: Record<string, number | null>): number {
  if (!innings) return 0;
  return Object.values(innings).reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

export function parseLiveScoreboard(game: ApiSportsGameResponse): LiveScoreboard {
  const homeTotal = game.scores?.home?.total ?? sumInningRuns(game.scores?.home?.innings);
  const awayTotal = game.scores?.away?.total ?? sumInningRuns(game.scores?.away?.innings);
  const awayInnings = game.scores?.away?.innings ?? undefined;
  const homeInnings = game.scores?.home?.innings ?? undefined;
  const parsed = parseInningFromStatus(game.status.short, game.status.long);

  const inferredInning = inferCurrentInningFromRuns(awayInnings, homeInnings);
  const inning =
    inferredInning != null && (parsed.inning == null || inferredInning > parsed.inning)
      ? inferredInning
      : parsed.inning;
  const inferredHalf =
    inning != null ? inferInningHalfFromRuns(inning, awayInnings, homeInnings) : null;
  const inningHalf = parsed.inningHalf ?? inferredHalf;
  const label =
    inning != null && inningHalf
      ? formatInningWithHalf(inning, inningHalf)
      : inning != null
        ? `${inning}회`
        : parsed.label;

  return {
    homeTeamName: game.teams.home.name,
    awayTeamName: game.teams.away.name,
    homeScore: homeTotal,
    awayScore: awayTotal,
    homeHits: game.scores?.home?.hits ?? 0,
    awayHits: game.scores?.away?.hits ?? 0,
    homeErrors: game.scores?.home?.errors ?? 0,
    awayErrors: game.scores?.away?.errors ?? 0,
    homeInnings,
    awayInnings,
    inning,
    inningHalf,
    inningLabel: label,
    statusShort: game.status.short,
    statusLong: game.status.long,
    syncedAt: new Date().toISOString(),
  };
}

export function buildInningKey(scoreboard: LiveScoreboard): string {
  return `${scoreboard.statusShort}:${scoreboard.homeScore}:${scoreboard.awayScore}:${scoreboard.inning ?? "na"}`;
}
