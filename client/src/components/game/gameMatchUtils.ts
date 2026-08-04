import { shouldClientPollMatch } from "@/lib/matchPollWindow";
import { getDisplayStadiumName } from "@shared/stadiumDisplay";
import {
  normalizeApiStatusShort,
} from "@shared/apiSportsStatus";
import type { LiveScoreboard } from "@shared/apiSportsTypes";
import {
  formatMatchTeamLineWithHeadToHead,
  formatMatchTeamLine,
  formatHeadToHeadRecordLine,
  resolveMatchTeamNames,
  type MatchHeadToHeadRecord,
  type MatchTeamNameInput,
} from "@shared/matchTeamDisplay";
import { resolveOperatorMatchPhase } from "@shared/operatorMatchStatus";

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
  registrationOrder?: number;
  /** 관리자 API 폴링 ON/OFF와 동일 (opN) */
  sideBetEnabled?: boolean;
  sideBetsLocked?: boolean;
  liveScoreboard?: Pick<LiveScoreboard, "statusShort" | "statusLong" | "inningLabel"> | null;
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

/** 예측 화면 상단 — 팀명 1줄 + 상대전적 2줄 */
export function resolveGameMatchHeaderLines(
  match: Pick<GameMatchItem, "awayTeamName" | "homeTeamName" | "headToHead">,
  liveScoreboard?: MatchTeamNameInput["liveScoreboard"],
): { teamNamesLine: string; headToHeadLine: string } {
  const { awayTeamName, homeTeamName } = resolveMatchTeamNames({
    apiSportsAwayTeam: match.awayTeamName,
    apiSportsHomeTeam: match.homeTeamName,
    liveScoreboard,
  });
  return {
    teamNamesLine: formatMatchTeamLine(awayTeamName, homeTeamName),
    headToHeadLine: formatHeadToHeadRecordLine(match.headToHead),
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

/** 시작 1분 전 ~ 종료 전, 또는 진행 중인 경기만 참여 가능 */
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

/** 경기 선택 모달 — 진행 상태 라벨 */
export function formatMatchStatusLabel(
  match: GameMatchItem,
  nowMs = Date.now(),
): string {
  const short = normalizeApiStatusShort(match.liveScoreboard?.statusShort);
  if (short === "SUSP" || short === "SUSPENDED") return "지연";

  const phase = resolveOperatorMatchPhase({
    matchStatus: match.matchStatus,
    statusShort: match.liveScoreboard?.statusShort,
    statusLong: match.liveScoreboard?.statusLong,
  });

  switch (phase) {
    case "경기종료":
      return "종료";
    case "연기됨":
      return "연기";
    case "경기중":
      return "경기 중";
    case "경기전":
      if (shouldClientPollMatch(match.startTime, match.matchStatus, undefined, nowMs)) {
        return "참여 가능";
      }
      return "시작 전";
    default:
      return "시작 전";
  }
}

/** 경기 선택 불가 사유 (모달 sublabel). 선택 가능하면 null */
export function getGameMatchSelectDisabledReason(match: GameMatchItem): string | null {
  if (!match.sideBetEnabled) return "연동 대기";

  const short = normalizeApiStatusShort(match.liveScoreboard?.statusShort);
  if (short === "SUSP" || short === "SUSPENDED") return "지연";

  const phase = resolveOperatorMatchPhase({
    matchStatus: match.matchStatus,
    statusShort: match.liveScoreboard?.statusShort,
    statusLong: match.liveScoreboard?.statusLong,
  });

  switch (phase) {
    case "경기종료":
      return "종료";
    case "연기됨":
      return "연기";
    case "경기전":
    case "경기중":
      return null;
    default:
      return "시작 전";
  }
}

/** API 폴링 ON + 경기전·경기중만 선택 가능 */
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
    const displayName = getDisplayStadiumName(match.stadiumName);
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
