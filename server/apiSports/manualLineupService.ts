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

/** 운영자/관리자 수동 타순·시즌 스탯 저장 (source=manual) */
export async function saveManualMatchLineup(
  matchId: string,
  input: { home: ManualBatterInput[]; away: ManualBatterInput[] },
): Promise<{
  matchLineup: MatchLineupSnapshot;
  matchPlayerStats: Record<string, MatchPlayerStatsEntry>;
}> {
  const syncedAt = new Date().toISOString();
  const home = normalizeSide(input.home ?? [], "home");
  const away = normalizeSide(input.away ?? [], "away");

  if (home.length === 0 && away.length === 0) {
    throw new Error("홈·원정 타순에 이름을 한 명 이상 입력하세요.");
  }

  const matchLineup: MatchLineupSnapshot = {
    syncedAt,
    home,
    away,
    source: "manual",
  };

  const matchPlayerStats: Record<string, MatchPlayerStatsEntry> = {};
  const applyStats = (side: "home" | "away", batters: ManualBatterInput[]) => {
    for (const batter of batters) {
      if (!batter?.name?.trim()) continue;
      const entry = toLineupEntry(side, batter);
      matchPlayerStats[String(entry.playerId)] = toStatsEntry(batter, syncedAt);
    }
  };
  applyStats("home", input.home ?? []);
  applyStats("away", input.away ?? []);

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
