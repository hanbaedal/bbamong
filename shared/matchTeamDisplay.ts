export interface MatchTeamNameInput {
  apiSportsAwayTeam?: string | null;
  apiSportsHomeTeam?: string | null;
  liveScoreboard?: { awayTeamName?: string; homeTeamName?: string } | null;
}

/** 시즌 상대전적 (승률 없음 — 승-패만) */
export interface MatchHeadToHeadRecord {
  awayWins: number;
  homeWins: number;
}

/** apiSports 필드 → liveScoreboard 순으로 팀명 해석 */
export function resolveMatchTeamNames(input: MatchTeamNameInput): {
  awayTeamName: string;
  homeTeamName: string;
} {
  const awayTeamName =
    input.apiSportsAwayTeam?.trim() || input.liveScoreboard?.awayTeamName?.trim() || "";
  const homeTeamName =
    input.apiSportsHomeTeam?.trim() || input.liveScoreboard?.homeTeamName?.trim() || "";
  return { awayTeamName, homeTeamName };
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

/** 팀명 아래 — 시즌 상대전적 2줄 (`원정 3승 · 홈 2승`, 없으면 `—`) */
export function formatHeadToHeadRecordLine(
  headToHead?: MatchHeadToHeadRecord | null,
): string {
  if (!headToHead) return "상대전적 —";
  const total = headToHead.awayWins + headToHead.homeWins;
  if (total <= 0) return "상대전적 —";
  return `상대전적 원정 ${headToHead.awayWins}승 · 홈 ${headToHead.homeWins}승`;
}
