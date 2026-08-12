import type { LineupBatterEntry, MatchLineupSnapshot, MatchPlayerStatsEntry } from "@shared/apiSportsTypes";
import { formatBattingAverage, formatOps } from "@shared/batterDisplay";
import { MatchModel } from "../UserStorage/db";

export type ManualBatterInput = {
  battingOrder: number;
  name: string;
  battingAverage?: string | number | null;
  hits?: number | null;
  homeRuns?: number | null;
  rbi?: number | null;
  ops?: string | number | null;
};

function toLineupEntry(side: "home" | "away", batter: ManualBatterInput): LineupBatterEntry {
  const order = Math.min(9, Math.max(1, Math.round(batter.battingOrder)));
  /** API playerId가 없을 때 슬롯 안정 키 — home 1~9, away 11~19 */
  const playerId = side === "home" ? order : 10 + order;
  return {
    playerId,
    name: batter.name.trim(),
    battingOrder: order,
  };
}

function toStatsEntry(batter: ManualBatterInput, syncedAt: string): MatchPlayerStatsEntry {
  return {
    battingAverage: formatBattingAverage(batter.battingAverage ?? null),
    hits: typeof batter.hits === "number" && Number.isFinite(batter.hits) ? Math.round(batter.hits) : null,
    homeRuns:
      typeof batter.homeRuns === "number" && Number.isFinite(batter.homeRuns)
        ? Math.round(batter.homeRuns)
        : null,
    rbi: typeof batter.rbi === "number" && Number.isFinite(batter.rbi) ? Math.round(batter.rbi) : null,
    ops: formatOps(batter.ops ?? null),
    syncedAt,
  };
}

function normalizeSide(batters: ManualBatterInput[], side: "home" | "away"): LineupBatterEntry[] {
  const cleaned = batters
    .filter((b) => b?.name?.trim())
    .map((b) => toLineupEntry(side, b))
    .sort((a, b) => a.battingOrder - b.battingOrder);

  const byOrder = new Map<number, LineupBatterEntry>();
  for (const entry of cleaned) {
    byOrder.set(entry.battingOrder, entry);
  }
  return Array.from(byOrder.values()).sort((a, b) => a.battingOrder - b.battingOrder);
}

function playerIdsForSide(side: "home" | "away"): string[] {
  return side === "home"
    ? ["1", "2", "3", "4", "5", "6", "7", "8", "9"]
    : ["11", "12", "13", "14", "15", "16", "17", "18", "19"];
}

/** 운영자/관리자 수동 타순·시즌 스탯 저장 (source=manual) */
export async function saveManualMatchLineup(
  matchId: string,
  input: {
    home?: ManualBatterInput[];
    away?: ManualBatterInput[];
    /** 지정 시 해당 팀만 갱신하고 반대 팀은 DB 값 유지 */
    side?: "home" | "away";
  },
): Promise<{
  matchLineup: MatchLineupSnapshot;
  matchPlayerStats: Record<string, MatchPlayerStatsEntry>;
}> {
  const existing = await MatchModel.findOne({ id: matchId })
    .select("matchLineup matchPlayerStats")
    .lean();
  if (!existing) {
    throw new Error("경기를 찾을 수 없습니다.");
  }

  const syncedAt = new Date().toISOString();
  const prevLineup = (existing.matchLineup as MatchLineupSnapshot | null) ?? null;
  const prevStats =
    (existing.matchPlayerStats as Record<string, MatchPlayerStatsEntry> | null) ?? {};

  const side = input.side;
  let home: LineupBatterEntry[];
  let away: LineupBatterEntry[];

  if (side === "home") {
    home = normalizeSide(input.home ?? [], "home");
    away = prevLineup?.away ?? [];
    if (home.length === 0) {
      throw new Error("홈 타순에 이름을 한 명 이상 입력하세요.");
    }
  } else if (side === "away") {
    away = normalizeSide(input.away ?? [], "away");
    home = prevLineup?.home ?? [];
    if (away.length === 0) {
      throw new Error("원정 타순에 이름을 한 명 이상 입력하세요.");
    }
  } else {
    home = normalizeSide(input.home ?? [], "home");
    away = normalizeSide(input.away ?? [], "away");
    if (home.length === 0 && away.length === 0) {
      throw new Error("홈·원정 타순에 이름을 한 명 이상 입력하세요.");
    }
  }

  const matchLineup: MatchLineupSnapshot = {
    syncedAt,
    home,
    away,
    source: "manual",
  };

  const matchPlayerStats: Record<string, MatchPlayerStatsEntry> = { ...prevStats };

  const rewriteSideStats = (target: "home" | "away", batters: ManualBatterInput[]) => {
    for (const id of playerIdsForSide(target)) {
      delete matchPlayerStats[id];
    }
    for (const batter of batters) {
      if (!batter?.name?.trim()) continue;
      const entry = toLineupEntry(target, batter);
      matchPlayerStats[String(entry.playerId)] = toStatsEntry(batter, syncedAt);
    }
  };

  if (side === "home" || side == null) {
    rewriteSideStats("home", input.home ?? []);
  }
  if (side === "away" || side == null) {
    rewriteSideStats("away", input.away ?? []);
  }

  const updated = await MatchModel.findOneAndUpdate(
    { id: matchId },
    { matchLineup, matchPlayerStats },
    { new: true },
  )
    .select("id")
    .lean();

  if (!updated) {
    throw new Error("경기를 찾을 수 없습니다.");
  }

  return { matchLineup, matchPlayerStats };
}
