import { shouldClientPollMatch } from "@/lib/matchPollWindow";
import { getDisplayStadiumName } from "@shared/stadiumDisplay";
import {
  isGameCancelledStatus,
  isGameSuspendedStatus,
  normalizeApiStatusShort,
} from "@shared/apiSportsStatus";
import type { LiveScoreboard } from "@shared/apiSportsTypes";
import {
  formatMatchTeamLineWithHeadToHead,
  formatMatchTeamLine,
  buildHeadToHeadDisplay,
  resolveHeadToHeadSeason,
  resolveMatchTeamNames,
  type HeadToHeadDisplayParts,
  type MatchHeadToHeadRecord,
  type MatchTeamNameInput,
} from "@shared/matchTeamDisplay";
import { resolveOperatorMatchPhase } from "@shared/operatorMatchStatus";
import { MATCH_STATUS_LABEL } from "@shared/matchStatusLabels";
import { isStartingLineupReady } from "@shared/todayStartingLineup";

export interface GameMatchItem {
  id: string;
  name: string;
  stadiumName: string;
  awayTeamName?: string;
  homeTeamName?: string;
  headToHead?: MatchHeadToHeadRecord | null;
  stadiumId: number;
  startTime: string;
  matchStatus: string;
  predictionEnabled?: boolean;
  currentRound?: number;
  registrationOrder?: number;
/** 관리자 실황 연동 ON/OFF와 동일 (opN, 다음·네이버) */
  sideBetEnabled?: boolean;
  sideBetsLocked?: boolean;
  liveScoreboard?: Pick<LiveScoreboard, "statusShort" | "statusLong" | "inningLabel"> | null;
  startingLineupReady?: boolean;
  matchLineup?: { home?: unknown[] | null; away?: unknown[] | null } | null;
}

export function formatMatchTitle(name: string): string {
  const trimmed = name.trim();
  if (trimmed.startsWith("제 ")) return trimmed;
  return `제 ${trimmed}`;
}

/** 경기 + (선택) live 스코어보드에서 팀명 1줄 */
export function formatGameMatchTeamLine(
  match: Pick<GameMatchItem, "awayTeamName" | "homeTeamName" | "headToHead">,
  liveScoreboard?: MatchTeamNameInput["liveScoreboard"],
): string {
  const { awayTeamName, homeTeamName } = resolveMatchTeamNames({
    apiSportsAwayTeam: match.awayTeamName,
    apiSportsHomeTeam: match.homeTeamName,
    liveScoreboard,
  });
  return formatMatchTeamLineWithHeadToHead(awayTeamName, homeTeamName, match.headToHead);
}

/** 예측 화면 상단 — 팀명 1줄 + 상대전적(시즌·팀명·승수) */
export function resolveGameMatchHeaderLines(
  match: Pick<GameMatchItem, "awayTeamName" | "homeTeamName" | "headToHead" | "startTime">,
  liveScoreboard?: MatchTeamNameInput["liveScoreboard"],
): { teamNamesLine: string; headToHead: HeadToHeadDisplayParts } {
  const { awayTeamName, homeTeamName } = resolveMatchTeamNames({
    apiSportsAwayTeam: match.awayTeamName,
    apiSportsHomeTeam: match.homeTeamName,
    liveScoreboard,
  });
  const season = resolveHeadToHeadSeason(
    match.headToHead as (MatchHeadToHeadRecord & { season?: number }) | null | undefined,
    match.startTime,
  );
  return {
    teamNamesLine: formatMatchTeamLine(awayTeamName, homeTeamName),
    headToHead: buildHeadToHeadDisplay({
      awayTeamName,
      homeTeamName,
      headToHead: match.headToHead,
      season,
    }),
  };
}

export function matchOrderKey(name: string): number {
  const match = name.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/** 당일 경기 선택 슬롯 수 (제1~5경기) */
export const DAILY_MATCH_SLOT_COUNT = 5;

export interface DailyMatchSlot {
  order: number;
  match: GameMatchItem | null;
}

export function resolveMatchSlotOrder(match: GameMatchItem): number {
  if (match.registrationOrder != null && match.registrationOrder >= 1) {
    return match.registrationOrder;
  }
  return matchOrderKey(match.name);
}

/** 제1~5경기 슬롯 — DB에 없는 번호는 match=null */
export function buildDailyMatchSlots(
  matches: GameMatchItem[],
  maxSlots = DAILY_MATCH_SLOT_COUNT,
): DailyMatchSlot[] {
  const byOrder = new Map<number, GameMatchItem>();
  for (const match of matches) {
    const order = resolveMatchSlotOrder(match);
    if (order < 1 || order > maxSlots) continue;
    if (!byOrder.has(order)) byOrder.set(order, match);
  }
  return Array.from({ length: maxSlots }, (_, index) => ({
    order: index + 1,
    match: byOrder.get(index + 1) ?? null,
  }));
}

export function sortMatchesByOrder<T extends { name: string }>(matches: T[]): T[] {
  return [...matches].sort((a, b) => matchOrderKey(a.name) - matchOrderKey(b.name));
}

/** 시작 5분 전 ~ 종료 전, 또는 진행 중인 경기만 참여 가능 */
export function filterJoinableMatches(
  matches: GameMatchItem[],
  nowMs = Date.now(),
): GameMatchItem[] {
  return matches.filter((m) => shouldClientPollMatch(m.startTime, m.matchStatus, undefined, nowMs));
}

/** 시작 시각이 가장 빠른 scheduled 경기 */
export function pickNextScheduledMatch(matches: GameMatchItem[]): GameMatchItem | null {
  const scheduled = matches.filter(
    (m) => m.matchStatus === "scheduled" && m.startTime,
  );
  if (scheduled.length === 0) return null;
  return [...scheduled].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  )[0] ?? null;
}

export function pickDefaultMatch(
  matches: GameMatchItem[],
  nowMs = Date.now(),
): GameMatchItem | null {
  const joinable = filterJoinableMatches(matches, nowMs);
  if (joinable.length === 0) return null;
  const ongoing = joinable.filter((m) => m.matchStatus === "ongoing");
  if (ongoing.length > 0) return sortMatchesByOrder(ongoing)[0] ?? null;
  return sortMatchesByOrder(joinable)[0] ?? null;
}

function formatCompactTeamWithWins(name: string, wins: number, hasGames: boolean): string {
  if (!hasGames || wins <= 0) return name;
  return `${name}(${wins}승)`;
}

/** 경기 선택 테이블 — `한화(3승) : 삼성(7승)` */
export function formatGameMatchSelectTeamLine(
  match: Pick<GameMatchItem, "awayTeamName" | "homeTeamName" | "headToHead">,
  liveScoreboard?: MatchTeamNameInput["liveScoreboard"],
): string {
  const { awayTeamName, homeTeamName } = resolveMatchTeamNames({
    apiSportsAwayTeam: match.awayTeamName,
    apiSportsHomeTeam: match.homeTeamName,
    liveScoreboard,
  });
  const away = awayTeamName.trim() || "원정팀";
  const home = homeTeamName.trim() || "홈팀";
  const headToHead = match.headToHead;
  if (!headToHead) return formatMatchTeamLine(away, home);
  const hasGames = headToHead.awayWins + headToHead.homeWins > 0;
  return `${formatCompactTeamWithWins(away, headToHead.awayWins, hasGames)} : ${formatCompactTeamWithWins(home, headToHead.homeWins, hasGames)}`;
}

function resolveMatchStatusDisplay(match: GameMatchItem): string {
  const short = normalizeApiStatusShort(match.liveScoreboard?.statusShort);
  if (isGameCancelledStatus(short) || match.matchStatus === "cancelled") {
    return MATCH_STATUS_LABEL.cancelled;
  }
  if (isGameSuspendedStatus(short)) return MATCH_STATUS_LABEL.suspended;

  const phase = resolveOperatorMatchPhase({
    matchStatus: match.matchStatus,
    statusShort: match.liveScoreboard?.statusShort,
    statusLong: match.liveScoreboard?.statusLong,
  });

  switch (phase) {
    case "경기종료":
      return MATCH_STATUS_LABEL.finished;
    case "연기됨":
      return MATCH_STATUS_LABEL.postponed;
    case "경기중":
      return MATCH_STATUS_LABEL.live;
    case "경기전":
    default:
      return hasPublishedStartingLineup(match)
        ? MATCH_STATUS_LABEL.scheduled
        : MATCH_STATUS_LABEL.upcoming;
  }
}

function hasPublishedStartingLineup(match: GameMatchItem): boolean {
  if (match.startingLineupReady === true) return true;
  return isStartingLineupReady(match.matchLineup);
}

/** 경기 선택 모달 — 진행 상태 라벨 */
export function formatMatchStatusLabel(
  match: GameMatchItem,
  _nowMs = Date.now(),
): string {
  return resolveMatchStatusDisplay(match);
}

/** 경기 선택 불가 사유 (모달 상세). 선택 가능하면 null */
export function getGameMatchSelectDisabledReason(match: GameMatchItem): string | null {
  if (!match.sideBetEnabled) return MATCH_STATUS_LABEL.syncPending;

  const short = normalizeApiStatusShort(match.liveScoreboard?.statusShort);
  if (isGameCancelledStatus(short) || match.matchStatus === "cancelled") {
    return MATCH_STATUS_LABEL.cancelled;
  }
  if (isGameSuspendedStatus(short)) return MATCH_STATUS_LABEL.suspended;

  const phase = resolveOperatorMatchPhase({
    matchStatus: match.matchStatus,
    statusShort: match.liveScoreboard?.statusShort,
    statusLong: match.liveScoreboard?.statusLong,
  });

  switch (phase) {
    case "경기종료":
      return MATCH_STATUS_LABEL.finished;
    case "연기됨":
      return MATCH_STATUS_LABEL.postponed;
    case "경기전":
    case "경기중":
      return null;
    default:
      return MATCH_STATUS_LABEL.scheduled;
  }
}

/** 경기 선택 테이블 오른쪽 칸 — `대구, 한화(3승) : 삼성(7승) 경기 전` */
export function formatGameMatchSelectDetail(
  match: GameMatchItem | null,
  nowMs = Date.now(),
): string {
  if (!match) return MATCH_STATUS_LABEL.noMatchToday;
  const stadium = getDisplayStadiumName(match.stadiumName, match.homeTeamName);
  const teams = formatGameMatchSelectTeamLine(match);
  const status = formatMatchStatusLabel(match, nowMs);
  const disabled = getGameMatchSelectDisabledReason(match);
  const statusPart =
    disabled && disabled !== status ? `${status} · ${disabled}` : status;
  if (stadium && teams) return `${stadium}, ${teams} ${statusPart}`;
  if (teams) return `${teams} ${statusPart}`;
  return statusPart;
}

/** 실황 연동 ON + 경기전·경기중만 선택 가능 */
export function isMatchSelectableForGame(match: GameMatchItem, _nowMs = Date.now()): boolean {
  return getGameMatchSelectDisabledReason(match) === null;
}

export interface StadiumOption {
  id: number;
  name: string;
}

export function collectStadiumOptions(matches: GameMatchItem[]): StadiumOption[] {
  const map = new Map<number, StadiumOption>();
  for (const match of matches) {
    if (match.stadiumId == null) continue;
    const displayName = getDisplayStadiumName(match.stadiumName, match.homeTeamName);
    if (!displayName) continue;
    if (!map.has(match.stadiumId)) {
      map.set(match.stadiumId, { id: match.stadiumId, name: displayName });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

export function pickFirstMatchAtStadium(
  matches: GameMatchItem[],
  stadiumId: number,
  nowMs = Date.now(),
): GameMatchItem | null {
  const atStadium = matches.filter((m) => m.stadiumId === stadiumId);
  return pickDefaultMatch(atStadium, nowMs);
}
