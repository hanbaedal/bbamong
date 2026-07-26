import type { LiveScoreboard } from "@shared/apiSportsTypes";
import type { ApiSportsGameResponse } from "./client";

function parseInningFromStatus(statusShort: string): { inning: number | null; label: string } {
  const short = statusShort.toUpperCase();
  const inningMatch = short.match(/^IN(\d+)$/);
  if (inningMatch) {
    const inning = Number(inningMatch[1]);
    return { inning, label: `${inning}회` };
  }
  if (short === "NS") return { inning: null, label: "시작 전" };
  if (short === "FT" || short === "FIN" || short === "AOT") {
    return { inning: null, label: "경기 종료" };
  }
  if (short.startsWith("POST")) return { inning: null, label: "경기 종료" };
  return { inning: null, label: statusShort || "진행 중" };
}

function sumInningRuns(innings?: Record<string, number | null>): number {
  if (!innings) return 0;
  return Object.values(innings).reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

export function parseLiveScoreboard(game: ApiSportsGameResponse): LiveScoreboard {
  const homeTotal = game.scores?.home?.total ?? sumInningRuns(game.scores?.home?.innings);
  const awayTotal = game.scores?.away?.total ?? sumInningRuns(game.scores?.away?.innings);
  const { inning, label } = parseInningFromStatus(game.status.short);

  return {
    homeTeamName: game.teams.home.name,
    awayTeamName: game.teams.away.name,
    homeScore: homeTotal,
    awayScore: awayTotal,
    homeHits: game.scores?.home?.hits ?? 0,
    awayHits: game.scores?.away?.hits ?? 0,
    homeErrors: game.scores?.home?.errors ?? 0,
    awayErrors: game.scores?.away?.errors ?? 0,
    inning,
    inningLabel: label,
    statusShort: game.status.short,
    statusLong: game.status.long,
    syncedAt: new Date().toISOString(),
  };
}

export function buildInningKey(scoreboard: LiveScoreboard): string {
  return `${scoreboard.statusShort}:${scoreboard.homeScore}:${scoreboard.awayScore}:${scoreboard.inning ?? "na"}`;
}

export function isGameFinished(statusShort: string): boolean {
  const short = statusShort.toUpperCase();
  return short === "FT" || short === "FIN" || short === "AOT" || short.startsWith("POST");
}

/** NS/TBD가 아니고 종료도 아니면 live(진행)로 간주 */
export function isGameLiveStatus(statusShort: string): boolean {
  const short = (statusShort || "").toUpperCase();
  if (short === "NS" || short === "TBD") return false;
  if (isGameFinished(short)) return false;
  return true;
}
