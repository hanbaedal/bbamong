import type { LineupBatterEntry, MatchLineupSnapshot, MatchPlayerStatsEntry } from "@shared/apiSportsTypes";
import { formatBattingAverage, formatOps } from "@shared/batterDisplay";
import { MatchModel } from "../UserStorage/db";
import { getKboPlayersByIds } from "../kboRoster/kboRosterService";

export type ManualBatterInput = {
  battingOrder: number;
  name?: string;
  rosterPlayerId?: string;
  battingAverage?: string | number | null;
  hits?: number | null;
  homeRuns?: number | null;
  rbi?: number | null;
  ops?: string | number | null;
  position?: string | null;
  note?: string | null;
};

function toLineupEntry(side: "home" | "away", batter: ManualBatterInput): LineupBatterEntry {
  const order = Math.min(9, Math.max(1, Math.round(batter.battingOrder)));
  /** API playerId가 없을 때 슬롯 안정 키 — home 1~9, away 11~19 */
  const playerId = side === "home" ? order : 10 + order;
  const rosterPlayerId = batter.rosterPlayerId?.trim() || undefined;
  return {
    playerId,
    name: (batter.name ?? "").trim(),
    battingOrder: order,
    ...(rosterPlayerId ? { rosterPlayerId } : {}),
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
    position: batter.position?.trim() || null,
    note: batter.note?.trim() || null,
    syncedAt,
  };
}

async function hydrateBatters(batters: ManualBatterInput[]): Promise<ManualBatterInput[]> {
  const ids = batters
    .map((b) => b.rosterPlayerId?.trim())
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return batters;
  const players = await getKboPlayersByIds(ids);
  const byId = new Map(players.map((p) => [p.id, p]));
  return batters.map((batter) => {
    const rosterId = batter.rosterPlayerId?.trim();
    if (!rosterId) return batter;
    const player = byId.get(rosterId);
    if (!player) {
      throw new Error("선택한 선수를 선수단에서 찾을 수 없습니다.");
    }
    return {
      ...batter,
      rosterPlayerId: player.id,
      name: player.name,
      battingAverage:
        batter.battingAverage != null && String(batter.battingAverage).trim() !== ""
          ? batter.battingAverage
          : player.battingAverage,
      hits: player.hits,
      homeRuns: player.homeRuns,
      rbi: player.rbi,
      ops: player.ops,
      position: batter.position?.trim() || player.position,
      note: batter.note?.trim() || player.note,
    };
  });
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

/** 운영자/관리자 타순·시즌 스탯 저장 (기본 source=manual) */
export async function saveManualMatchLineup(
  matchId: string,
  input: {
    home?: ManualBatterInput[];
    away?: ManualBatterInput[];
    /** 지정 시 해당 팀만 갱신하고 반대 팀은 DB 값 유지 */
    side?: "home" | "away";
    source?: MatchLineupSnapshot["source"];
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
  const homeInput = side === "away" ? [] : await hydrateBatters(input.home ?? []);
  const awayInput = side === "home" ? [] : await hydrateBatters(input.away ?? []);
  let home: LineupBatterEntry[];
  let away: LineupBatterEntry[];

  if (side === "home") {
    home = normalizeSide(homeInput, "home");
    away = prevLineup?.away ?? [];
    if (home.length === 0) {
      throw new Error("홈 타순에서 선수를 한 명 이상 선택하세요.");
    }
  } else if (side === "away") {
    away = normalizeSide(awayInput, "away");
    home = prevLineup?.home ?? [];
    if (away.length === 0) {
      throw new Error("원정 타순에서 선수를 한 명 이상 선택하세요.");
    }
  } else {
    home = normalizeSide(homeInput, "home");
    away = normalizeSide(awayInput, "away");
    if (home.length === 0 && away.length === 0) {
      throw new Error("홈·원정 타순에서 선수를 한 명 이상 선택하세요.");
    }
  }

  const matchLineup: MatchLineupSnapshot = {
    syncedAt,
    home,
    away,
    source: input.source ?? "manual",
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
    rewriteSideStats("home", homeInput);
  }
  if (side === "away" || side == null) {
    rewriteSideStats("away", awayInput);
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

  try {
    const { refreshMatchSeasonContext } = await import("../daumLive/daumSeasonStatsService");
    await refreshMatchSeasonContext(matchId, { force: true });
    const refreshed = await MatchModel.findOne({ id: matchId }).select("matchPlayerStats").lean();
    if (refreshed?.matchPlayerStats) {
      return {
        matchLineup,
        matchPlayerStats: refreshed.matchPlayerStats as Record<string, MatchPlayerStatsEntry>,
      };
    }
  } catch (error) {
    console.warn(`[ManualLineup] daum season stats ${matchId}:`, error);
  }

  return { matchLineup, matchPlayerStats };
}
