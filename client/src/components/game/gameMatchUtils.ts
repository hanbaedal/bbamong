import { shouldClientPollMatch } from "@/lib/matchPollWindow";
import { getDisplayStadiumName } from "@shared/stadiumDisplay";

export interface GameMatchItem {
  id: string;
  name: string;
  stadiumName: string;
  stadiumId: number;
  startTime: string;
  matchStatus: string;
  predictionEnabled?: boolean;
  registrationOrder?: number;
  /** 관리자 API 폴링 ON/OFF와 동일 (opN) */
  sideBetEnabled?: boolean;
  sideBetsLocked?: boolean;
}

export function formatMatchTitle(name: string): string {
  const trimmed = name.trim();
  if (trimmed.startsWith("제 ")) return trimmed;
  return `제 ${trimmed}`;
}

export function matchOrderKey(name: string): number {
  const match = name.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
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
