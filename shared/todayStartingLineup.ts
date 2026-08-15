export type TodayLineupMatchStatus = "matched" | "unmatched" | "ambiguous";

export type TodayLineupBatter = {
  battingOrder: number;
  name: string;
  position: string;
  positionRaw: string;
  battingAverage: string | null;
  playerCode?: string;
  rosterPlayerId?: string;
  rosterMatch: TodayLineupMatchStatus;
};

export type TodayLineupSide = {
  teamShort: string;
  teamName: string;
  batters: TodayLineupBatter[];
  source: "boxscore" | "preview" | "none";
};

export type TodayLineupGame = {
  daumGameId: number;
  naverGameId: string;
  gameUrl: string;
  startTime: string;
  gameStatus: string;
  home: TodayLineupSide;
  away: TodayLineupSide;
  fetchError?: string;
  ppamongMatchId: string | null;
  registrationOrder: number | null;
  ppamongMatchName: string | null;
  alreadyApplied: boolean;
  /** 운영자가 타순을 직접 넣은 경우 — 자동 적용 금지 */
  operatorLineupLocked: boolean;
  ppamongMatchStatus: string | null;
};

/** 양팀 선발 9명이 타순에 있으면 선발명단 공개로 본다 */
export function isStartingLineupReady(
  lineup?: { home?: unknown[] | null; away?: unknown[] | null } | null,
): boolean {
  return (lineup?.home?.length ?? 0) >= 9 && (lineup?.away?.length ?? 0) >= 9;
}

export type TodayLineupApplyResult = {
  daumGameId: number;
  matchId: string | null;
  applied: boolean;
  homeCount: number;
  awayCount: number;
  unmatchedNames: string[];
  error?: string;
};
