import type {
  CurrentBatterPreview,
  LineupBatterEntry,
  MatchLineupSnapshot,
  PinchHitterSnapshot,
} from "./apiSportsTypes";
import type { InningHalf } from "./gamePhaseTypes";

/** 타율 표시 — ".285" 또는 "0.285" → ".285" */
export function formatBattingAverage(value: string | number | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    return value >= 1
      ? value.toFixed(3)
      : `.${Math.round(value * 1000)
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

/** OPS 등 — ".812" / "1.012" */
export function formatOps(value: string | number | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    if (value >= 1) return value.toFixed(3);
    return `.${Math.round(value * 1000)
      .toString()
      .padStart(3, "0")}`;
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(".")) return trimmed;
  const num = Number.parseFloat(trimmed);
  if (!Number.isFinite(num) || num <= 0) return null;
  if (num >= 1) return num.toFixed(3);
  return `.${Math.round(num * 1000)
    .toString()
    .padStart(3, "0")}`;
}

export function formatStatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return String(Math.round(value));
}

export function formatStatDisplay(value: string | null | undefined): string {
  return value?.trim() ? value.trim() : "—";
}

/** 스코어보드 아래 2번째 줄 — "김하성 · 타율 .285" */
export function formatBatterStatsLine(batter: CurrentBatterPreview | null | undefined): string | null {
  if (!batter?.playerName?.trim()) return null;
  const avg = batter.battingAverage ? `타율 ${batter.battingAverage}` : null;
  return avg ? `${batter.playerName.trim()} · ${avg}` : batter.playerName.trim();
}

export interface PlayerStatsForBatterPreview {
  battingAverage?: string | null;
  hits?: number | null;
  homeRuns?: number | null;
  rbi?: number | null;
  ops?: string | null;
}

function pickLineupSide(
  lineup: MatchLineupSnapshot,
  inningHalf: InningHalf,
): LineupBatterEntry[] {
  return inningHalf === "top" ? lineup.away : lineup.home;
}

function emptyBatterPreview(orderLabel: string, season: number): CurrentBatterPreview {
  return {
    orderLabel,
    playerName: null,
    battingAverage: null,
    hits: null,
    homeRuns: null,
    rbi: null,
    ops: null,
    season,
    isPinchHitter: false,
  };
}

function applyPinchHitter(
  base: CurrentBatterPreview,
  pinch: PinchHitterSnapshot | null | undefined,
  inningHalf: InningHalf,
  batterIndexInHalf: number,
): CurrentBatterPreview {
  if (!pinch?.playerName?.trim()) return { ...base, isPinchHitter: false };
  const pinchHalf = pinch.inningHalf === "bottom" ? "bottom" : "top";
  if (pinchHalf !== inningHalf) return { ...base, isPinchHitter: false };
  if (pinch.batterIndexInHalf !== batterIndexInHalf) return { ...base, isPinchHitter: false };

  return {
    orderLabel: base.orderLabel,
    playerName: pinch.playerName.trim(),
    battingAverage: formatBattingAverage(pinch.battingAverage),
    hits: pinch.hits ?? null,
    homeRuns: pinch.homeRuns ?? null,
    rbi: pinch.rbi ?? null,
    ops: formatOps(pinch.ops),
    season: pinch.season || base.season,
    isPinchHitter: true,
  };
}

/**
 * 운영자 gamePhase 타순(batterIndexInHalf) + API 라인업 → 현재 타자
 * batterIndexInHalf는 1-based, 라인업은 battingOrder 기준
 * pinchHitter가 현재 타석과 일치하면 대타로 덮어씀
 */
export function resolveCurrentBatterPreview(input: {
  lineup: MatchLineupSnapshot | null | undefined;
  inningHalf: InningHalf;
  batterIndexInHalf: number;
  playerStats?: Record<string, PlayerStatsForBatterPreview> | null;
  season: number;
  pinchHitter?: PinchHitterSnapshot | null;
}): CurrentBatterPreview {
  const orderLabel = `${input.batterIndexInHalf}번째 타자`;
  const lineup = input.lineup;
  if (!lineup || (lineup.home.length === 0 && lineup.away.length === 0)) {
    return applyPinchHitter(
      emptyBatterPreview(orderLabel, input.season),
      input.pinchHitter,
      input.inningHalf,
      input.batterIndexInHalf,
    );
  }

  const side = pickLineupSide(lineup, input.inningHalf);
  const sorted = [...side].sort((a, b) => a.battingOrder - b.battingOrder);
  if (sorted.length === 0) {
    return applyPinchHitter(
      emptyBatterPreview(orderLabel, input.season),
      input.pinchHitter,
      input.inningHalf,
      input.batterIndexInHalf,
    );
  }

  const index = Math.max(0, input.batterIndexInHalf - 1);
  const player = sorted[index] ?? sorted[index % sorted.length];
  const stats = input.playerStats?.[String(player.playerId)];

  const base: CurrentBatterPreview = {
    orderLabel,
    playerName: player.name,
    battingAverage: formatBattingAverage(stats?.battingAverage ?? null),
    hits: stats?.hits ?? null,
    homeRuns: stats?.homeRuns ?? null,
    rbi: stats?.rbi ?? null,
    ops: formatOps(stats?.ops ?? null),
    season: input.season,
    isPinchHitter: false,
  };

  return applyPinchHitter(base, input.pinchHitter, input.inningHalf, input.batterIndexInHalf);
}
