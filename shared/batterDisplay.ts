import type { CurrentBatterPreview, LineupBatterEntry, MatchLineupSnapshot } from "./apiSportsTypes";
import type { InningHalf } from "./gamePhaseTypes";

/** 타율 표시 — ".285" 또는 "0.285" → ".285" */
export function formatBattingAverage(value: string | number | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    return value >= 1 ? value.toFixed(3) : `.${Math.round(value * 1000)
      .toString()
      .padStart(3, "0")}`;
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(".")) return trimmed;
  const num = Number.parseFloat(trimmed);
  if (Number.isFinite(num) && num > 0 && num < 1) {
    return `.${Math.round(num * 1000)
      .toString()
      .padStart(3, "0")}`;
  }
  return trimmed;
}

/** 스코어보드 아래 2번째 줄 — "김하성 · 타율 .285" */
export function formatBatterStatsLine(batter: CurrentBatterPreview | null | undefined): string | null {
  if (!batter?.playerName?.trim()) return null;
  const avg = batter.battingAverage ? `타율 ${batter.battingAverage}` : null;
  return avg ? `${batter.playerName.trim()} · ${avg}` : batter.playerName.trim();
}

function pickLineupSide(
  lineup: MatchLineupSnapshot,
  inningHalf: InningHalf,
): LineupBatterEntry[] {
  return inningHalf === "top" ? lineup.away : lineup.home;
}

/**
 * 운영자 gamePhase 타순(batterIndexInHalf) + API 라인업 → 현재 타자
 * batterIndexInHalf는 1-based, 라인업은 battingOrder 기준
 */
export function resolveCurrentBatterPreview(input: {
  lineup: MatchLineupSnapshot | null | undefined;
  inningHalf: InningHalf;
  batterIndexInHalf: number;
  playerStats?: Record<string, { battingAverage?: string | null }> | null;
  season: number;
}): CurrentBatterPreview {
  const orderLabel = `${input.batterIndexInHalf}번째 타자`;
  const lineup = input.lineup;
  if (!lineup || (lineup.home.length === 0 && lineup.away.length === 0)) {
    return {
      orderLabel,
      playerName: null,
      battingAverage: null,
      season: input.season,
    };
  }

  const side = pickLineupSide(lineup, input.inningHalf);
  const sorted = [...side].sort((a, b) => a.battingOrder - b.battingOrder);
  if (sorted.length === 0) {
    return { orderLabel, playerName: null, battingAverage: null, season: input.season };
  }

  const index = Math.max(0, input.batterIndexInHalf - 1);
  const player = sorted[index] ?? sorted[index % sorted.length];
  const stats = input.playerStats?.[String(player.playerId)];

  return {
    orderLabel,
    playerName: player.name,
    battingAverage: formatBattingAverage(stats?.battingAverage ?? null),
    season: input.season,
  };
}
