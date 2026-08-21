import type {
  CurrentBatterPreview,
  LineupBatterEntry,
  MatchLineupSnapshot,
  PinchHitterSnapshot,
} from "./apiSportsTypes";
import { parseBatterHandSide } from "./batterHandedness";
import { wrapBatterOrder, type InningHalf } from "./gamePhaseTypes";

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

/** 시즌 타율·출루율 등 — "0.327" (요청 표기) */
export function formatSeasonRate(
  value: string | number | null | undefined,
  digits = 3,
): string | null {
  if (value == null || value === "") return null;
  const num =
    typeof value === "number" ? value : Number.parseFloat(String(value).trim().replace(/^\./, "0."));
  if (!Number.isFinite(num) || num < 0) return null;
  return num.toFixed(digits);
}

/** 평균자책 — "4.76" */
export function formatEra(value: string | number | null | undefined): string | null {
  if (value == null || value === "") return null;
  const num = typeof value === "number" ? value : Number.parseFloat(String(value).trim());
  if (!Number.isFinite(num) || num < 0) return null;
  return num.toFixed(2);
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
  runs?: number | null;
  stolenBases?: number | null;
  onBasePercentage?: string | null;
  position?: string | null;
  note?: string | null;
  batsThrows?: string | null;
}

function pickLineupSide(
  lineup: MatchLineupSnapshot,
  inningHalf: InningHalf,
): LineupBatterEntry[] {
  return inningHalf === "top" ? lineup.away : lineup.home;
}

/** 실황/라인업 이름 비교 — 공백·대소문자 무시 */
export function normalizeBatterName(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase();
}

/** 실황 타자명 → 공격 측 라인업 매칭 (정확 → 포함) */
export function findLineupBatterByName(
  side: LineupBatterEntry[],
  liveName: string,
): LineupBatterEntry | null {
  const target = normalizeBatterName(liveName);
  if (!target || side.length === 0) return null;
  const sorted = [...side].sort((a, b) => a.battingOrder - b.battingOrder);
  const exact = sorted.find((p) => normalizeBatterName(p.name) === target);
  if (exact) return exact;
  return (
    sorted.find((p) => {
      const n = normalizeBatterName(p.name);
      return n.length > 0 && (target.includes(n) || n.includes(target));
    }) ?? null
  );
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
    runs: null,
    stolenBases: null,
    onBasePercentage: null,
    position: null,
    note: null,
    season,
    isPinchHitter: false,
    batsSide: null,
  };
}

function applyPinchHitter(
  base: CurrentBatterPreview,
  pinch: PinchHitterSnapshot | null | undefined,
  inningHalf: InningHalf,
  batterIndexInHalf: number,
): CurrentBatterPreview {
  if (!pinch?.playerName?.trim()) return base;
  const pinchHalf = pinch.inningHalf === "bottom" ? "bottom" : "top";
  if (pinchHalf !== inningHalf) return base;
  if (pinch.batterIndexInHalf !== batterIndexInHalf) return base;

  return {
    orderLabel: base.orderLabel,
    playerName: pinch.playerName.trim(),
    battingAverage: formatSeasonRate(pinch.battingAverage) ?? formatBattingAverage(pinch.battingAverage),
    hits: pinch.hits ?? null,
    homeRuns: pinch.homeRuns ?? null,
    rbi: pinch.rbi ?? null,
    ops: formatSeasonRate(pinch.ops) ?? formatOps(pinch.ops),
    runs: pinch.runs ?? null,
    stolenBases: pinch.stolenBases ?? null,
    onBasePercentage:
      formatSeasonRate(pinch.onBasePercentage) ?? formatBattingAverage(pinch.onBasePercentage),
    position: pinch.position ?? null,
    note: pinch.note ?? null,
    season: pinch.season || base.season,
    isPinchHitter: true,
    batsSide: base.batsSide ?? null,
  };
}

/**
 * 운영자 gamePhase 타순(batterIndexInHalf) + API 라인업 → 현재 타자
 * liveBatterName(실황)이 있으면 공격 측 라인업에서 이름 매칭을 우선
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
  /** 네이버/다음 실황 현재 타자명 — 있으면 라인업·스탯 매칭 우선 */
  liveBatterName?: string | null;
}): CurrentBatterPreview {
  let battingOrder = wrapBatterOrder(input.batterIndexInHalf);
  const slotOrder = battingOrder;
  const liveName = input.liveBatterName?.trim() || "";
  const lineup = input.lineup;
  const hasLineup = Boolean(lineup && (lineup.home.length > 0 || lineup.away.length > 0));
  const side = hasLineup ? pickLineupSide(lineup!, input.inningHalf) : [];
  const sorted = [...side].sort((a, b) => a.battingOrder - b.battingOrder);
  const otherSide = hasLineup
    ? pickLineupSide(lineup!, input.inningHalf === "top" ? "bottom" : "top")
    : [];
  const slotExpected =
    sorted.find((p) => wrapBatterOrder(p.battingOrder) === slotOrder) ?? null;

  let player: LineupBatterEntry | null = null;
  if (liveName && hasLineup) {
    player = findLineupBatterByName(sorted, liveName);
    if (!player) player = findLineupBatterByName(otherSide, liveName);
    if (player) battingOrder = wrapBatterOrder(player.battingOrder);
  }

  const orderLabel = `${slotOrder}번 타자`;
  // 대타 = 실황 타자가 해당 팀 선발 타순에 없을 때만 (단순 타순 슬롯 불일치는 대타 아님)
  const liveIsPinch = Boolean(liveName && !player);

  // 실황 타자가 선발 라인업에 없음 → 대타. 선발 이름으로 덮지 않음
  if (liveName && !player) {
    const empty = emptyBatterPreview(orderLabel, input.season);
    empty.playerName = liveName;
    empty.isPinchHitter = true;
    const withPinch = applyPinchHitter(empty, input.pinchHitter, input.inningHalf, slotOrder);
    if (withPinch.isPinchHitter && withPinch.playerName) return withPinch;
    return {
      ...empty,
      playerName: liveName,
      isPinchHitter: true,
      position:
        slotExpected && input.playerStats?.[String(slotExpected.playerId)]?.position
          ? input.playerStats[String(slotExpected.playerId)]!.position!
          : null,
    };
  }

  if (sorted.length === 0 && !player) {
    const empty = emptyBatterPreview(orderLabel, input.season);
    if (liveName) empty.playerName = liveName;
    return applyPinchHitter(empty, input.pinchHitter, input.inningHalf, slotOrder);
  }

  if (!player) {
    player =
      slotExpected ?? sorted[(slotOrder - 1) % Math.max(sorted.length, 1)] ?? null;
  }

  if (!player) {
    const empty = emptyBatterPreview(orderLabel, input.season);
    if (liveName) empty.playerName = liveName;
    return applyPinchHitter(empty, input.pinchHitter, input.inningHalf, slotOrder);
  }

  const stats = input.playerStats?.[String(player.playerId)];

  const base: CurrentBatterPreview = {
    orderLabel,
    playerName: player.name,
    battingAverage:
      formatSeasonRate(stats?.battingAverage ?? null) ??
      formatBattingAverage(stats?.battingAverage ?? null),
    hits: stats?.hits ?? null,
    homeRuns: stats?.homeRuns ?? null,
    rbi: stats?.rbi ?? null,
    ops: formatSeasonRate(stats?.ops ?? null) ?? formatOps(stats?.ops ?? null),
    runs: stats?.runs ?? null,
    stolenBases: stats?.stolenBases ?? null,
    onBasePercentage:
      formatSeasonRate(stats?.onBasePercentage ?? null) ??
      formatBattingAverage(stats?.onBasePercentage ?? null),
    position: stats?.position ?? null,
    note: stats?.note ?? null,
    season: input.season,
    isPinchHitter: liveIsPinch,
    batsSide: parseBatterHandSide(stats?.batsThrows ?? null),
  };

  // 실황 타자가 선발이면 DB 잔여 대타 스냅샷으로 덮지 않음 (대타 반복 표시 방지)
  if (liveName && player) return base;
  return applyPinchHitter(base, input.pinchHitter, input.inningHalf, slotOrder);
}
