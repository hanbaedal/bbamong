import type { KboTeamShort } from "./kboHomeStadium";
import { isKboTeamShort } from "./kboHomeStadium";

export const KBO_BATTER_POSITIONS = [
  "투수",
  "포수",
  "1루수",
  "2루수",
  "3루수",
  "유격수",
  "좌익수",
  "중견수",
  "우익수",
  "지명타자",
] as const;

export type KboBatterPosition = (typeof KBO_BATTER_POSITIONS)[number];

export function isKboBatterPosition(value: string): value is KboBatterPosition {
  return (KBO_BATTER_POSITIONS as readonly string[]).includes(value);
}

/** 관리자 선수단 + 운영자 선택 목록 */
export interface KboRosterPlayer {
  id: string;
  team: KboTeamShort | string;
  season: number;
  name: string;
  position: string;
  battingAverage: string | null;
  hits: number | null;
  homeRuns: number | null;
  rbi: number | null;
  ops: string | null;
  /** 특징 */
  note: string;
  active: boolean;
  updatedAt: string;
}

export function assertKboTeamShort(team: string): KboTeamShort {
  const trimmed = team.trim();
  if (!isKboTeamShort(trimmed)) {
    throw new Error("KBO 10구단 약칭이 아닙니다.");
  }
  return trimmed;
}
