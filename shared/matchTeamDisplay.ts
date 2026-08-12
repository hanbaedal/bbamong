import type { LiveScoreboard } from "@shared/apiSportsTypes";
import { formatKboTeamShortName } from "./kboHomeStadium";

export interface MatchTeamNameInput {
  apiSportsAwayTeam?: string | null;
  apiSportsHomeTeam?: string | null;
  liveScoreboard?: { awayTeamName?: string; homeTeamName?: string } | null;
}

/** 시즌 상대전적 (승률 없음 — 승-패만) */
export interface MatchHeadToHeadRecord {
  awayWins: number;
  homeWins: number;
  season?: number;
}

/** apiSports 필드 → liveScoreboard 순으로 팀명 해석 */
export function resolveMatchTeamNames(input: MatchTeamNameInput): {
  awayTeamName: string;
  homeTeamName: string;
} {
  const awayRaw =
    input.apiSportsAwayTeam?.trim() || input.liveScoreboard?.awayTeamName?.trim() || "";
  const homeRaw =
    input.apiSportsHomeTeam?.trim() || input.liveScoreboard?.homeTeamName?.trim() || "";
  return {
    awayTeamName: formatKboTeamShortName(awayRaw),
    homeTeamName: formatKboTeamShortName(homeRaw),
  };
}

/** 스코어보드 상단·이닝표 팀 열 — KBO 약칭 (NC, 두산 …) */
export function getScoreboardDisplayTeamLabels(
  scoreboard?: Pick<LiveScoreboard, "awayTeamName" | "homeTeamName"> | null,
  options?: { awayFallback?: string; homeFallback?: string },
): { awayLabel: string; homeLabel: string } {
  return {
    awayLabel: formatKboTeamShortName(scoreboard?.awayTeamName, options?.awayFallback ?? "원정"),
    homeLabel: formatKboTeamShortName(scoreboard?.homeTeamName, options?.homeFallback ?? "홈"),
  };
}

/** 사용자·운영자 공통 팀명 1줄 — `원정 : 홈` */
export function formatMatchTeamLine(
  awayTeamName: string,
  homeTeamName: string,
  separator = " : ",
): string {
  return formatMatchTeamLineWithHeadToHead(awayTeamName, homeTeamName, null, separator);
}

function formatTeamWithWins(name: string, wins: number, hasGames: boolean): string {
  if (!hasGames || wins <= 0) return name;
  return `${name} (${wins}승)`;
}

/** 팀명 + 시즌 상대전적 — `LG (3승) : 두산 (2승)` */
export function formatMatchTeamLineWithHeadToHead(
  awayTeamName: string,
  homeTeamName: string,
  headToHead?: MatchHeadToHeadRecord | null,
  separator = " : ",
): string {
  const away = awayTeamName.trim() || "원정팀";
  const home = homeTeamName.trim() || "홈팀";
  if (!headToHead) return `${away}${separator}${home}`;

  const hasGames = headToHead.awayWins + headToHead.homeWins > 0;
  const awayLabel = formatTeamWithWins(away, headToHead.awayWins, hasGames);
  const homeLabel = formatTeamWithWins(home, headToHead.homeWins, hasGames);
  return `${awayLabel}${separator}${homeLabel}`;
}

/** 시즌 상대전적 표시용 (UI 색 분리) */
export interface HeadToHeadDisplayParts {
  season: number;
  awayName: string;
  homeName: string;
  awayWins: number;
  homeWins: number;
  /** 종료 경기 승패가 하나도 없으면 true */
  empty: boolean;
}

export function resolveHeadToHeadSeason(
  headToHead?: (MatchHeadToHeadRecord & { season?: number }) | null,
  fallbackDate?: string | Date | null,
): number {
  if (headToHead && typeof headToHead.season === "number" && headToHead.season > 2000) {
    return headToHead.season;
  }
  if (fallbackDate) {
    const d = typeof fallbackDate === "string" ? fallbackDate : fallbackDate.toISOString();
    const year = Number(d.slice(0, 4));
    if (Number.isFinite(year) && year > 2000) return year;
  }
  return new Date().getFullYear();
}

export function buildHeadToHeadDisplay(input: {
  awayTeamName: string;
  homeTeamName: string;
  headToHead?: (MatchHeadToHeadRecord & { season?: number }) | null;
  season?: number;
}): HeadToHeadDisplayParts {
  const season = input.season ?? resolveHeadToHeadSeason(input.headToHead);
  const awayName = input.awayTeamName.trim() || "원정";
  const homeName = input.homeTeamName.trim() || "홈";
  if (!input.headToHead) {
    return { season, awayName, homeName, awayWins: 0, homeWins: 0, empty: true };
  }
  const awayWins = input.headToHead.awayWins;
  const homeWins = input.headToHead.homeWins;
  const empty = awayWins + homeWins <= 0;
  return { season, awayName, homeName, awayWins, homeWins, empty };
}

/** 팀명 아래 — 시즌 상대전적 (`2026 상대전적 한화 6승 : 두산 6승`, 없으면 `—`) */
export function formatHeadToHeadRecordLine(
  headToHead?: MatchHeadToHeadRecord | null,
  options?: {
    awayTeamName?: string;
    homeTeamName?: string;
    season?: number;
  },
): string {
  const parts = buildHeadToHeadDisplay({
    awayTeamName: options?.awayTeamName ?? "원정",
    homeTeamName: options?.homeTeamName ?? "홈",
    headToHead,
    season: options?.season,
  });
  if (parts.empty) return `${parts.season} 상대전적 —`;
  return `${parts.season} 상대전적 ${parts.awayName} ${parts.awayWins}승 : ${parts.homeName} ${parts.homeWins}승`;
}
