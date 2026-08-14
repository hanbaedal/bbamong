import type { KboTeamShort } from "./kboHomeStadium";
import { isKboTeamShort } from "./kboHomeStadium";

export const KBO_BATTER_POSITIONS = [
  "투수",
  "포수",
  "내야수",
  "외야수",
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

const API_POSITION_ALIASES: Record<string, KboBatterPosition> = {
  p: "투수",
  pitcher: "투수",
  sp: "투수",
  rp: "투수",
  투수: "투수",
  c: "포수",
  catcher: "포수",
  포수: "포수",
  "1b": "1루수",
  "1루": "1루수",
  "1루수": "1루수",
  firstbase: "1루수",
  "first base": "1루수",
  "first baseman": "1루수",
  "2b": "2루수",
  "2루": "2루수",
  "2루수": "2루수",
  secondbase: "2루수",
  "second base": "2루수",
  "second baseman": "2루수",
  "3b": "3루수",
  "3루": "3루수",
  "3루수": "3루수",
  thirdbase: "3루수",
  "third base": "3루수",
  "third baseman": "3루수",
  ss: "유격수",
  shortstop: "유격수",
  유격수: "유격수",
  lf: "좌익수",
  "left field": "좌익수",
  "left fielder": "좌익수",
  leftfielder: "좌익수",
  좌익수: "좌익수",
  좌익: "좌익수",
  cf: "중견수",
  "center field": "중견수",
  "center fielder": "중견수",
  centerfielder: "중견수",
  중견수: "중견수",
  중견: "중견수",
  rf: "우익수",
  "right field": "우익수",
  "right fielder": "우익수",
  rightfielder: "우익수",
  우익수: "우익수",
  우익: "우익수",
  of: "외야수",
  outfield: "외야수",
  outfielder: "외야수",
  외야수: "외야수",
  dh: "지명타자",
  "designated hitter": "지명타자",
  designatedhitter: "지명타자",
  지명타자: "지명타자",
  지명: "지명타자",
  if: "내야수",
  infielder: "내야수",
  내야수: "내야수",
};

export function mapApiPositionToKbo(raw?: string | null): KboBatterPosition {
  const key = (raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return "지명타자";
  return API_POSITION_ALIASES[key] ?? API_POSITION_ALIASES[key.replace(/\./g, "")] ?? "지명타자";
}

/** 관리자 선수단 + 운영자 선택 목록 */
export interface KboRosterPlayer {
  id: string;
  team: KboTeamShort | string;
  season: number;
  name: string;
  position: string;
  /** 등번호 */
  jerseyNumber: string;
  /** 투타유형 (우투우타 등) */
  batsThrows: string;
  battingAverage: string | null;
  hits: number | null;
  homeRuns: number | null;
  rbi: number | null;
  ops: string | null;
  /** 특징 */
  note: string;
  active: boolean;
  apiSportsPlayerId?: number | null;
  updatedAt: string;
}

export function assertKboTeamShort(team: string): KboTeamShort {
  const trimmed = team.trim();
  if (!isKboTeamShort(trimmed)) {
    throw new Error("KBO 10구단 약칭이 아닙니다.");
  }
  return trimmed;
}
