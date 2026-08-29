import {
  battingSideLabel,
  formatInningWithHalf,
  nextBatterOrder,
  parseInningHalf,
  wrapBatterOrder,
  type InningHalf,
} from "@shared/gamePhaseTypes";

export { battingSideLabel, formatInningWithHalf, inningHalfShortLabel } from "@shared/gamePhaseTypes";

export function buildGamePhaseDisplay(input: {
  name: string;
  gameInning: number;
  inningHalf: InningHalf;
  batterIndexInHalf: number;
}): string {
  return `${input.name} · ${formatInningWithHalf(input.gameInning, input.inningHalf)} · ${input.batterIndexInHalf}번째 타자`;
}

export function buildGamePhasePayload(match: {
  name: string;
  gameInning?: number | null;
  inningHalf?: string | null;
  batterIndexInHalf?: number | null;
  currentRound?: number;
}) {
  const gameInning = match.gameInning ?? 1;
  const inningHalf = parseInningHalf(match.inningHalf);
  const batterIndexInHalf = match.batterIndexInHalf ?? 1;
  return {
    gameInning,
    inningHalf,
    batterIndexInHalf,
    battingSideLabel: battingSideLabel(inningHalf),
    displayLabel: buildGamePhaseDisplay({
      name: match.name,
      gameInning,
      inningHalf,
      batterIndexInHalf,
    }),
    currentRound: match.currentRound ?? 1,
  };
}

export function computeNextBatterPhase(current: {
  gameInning: number;
  inningHalf: InningHalf;
  batterIndexInHalf: number;
  awayBatterOrder?: number | null;
  homeBatterOrder?: number | null;
}) {
  const nextOrder = nextBatterOrder(current.batterIndexInHalf);
  const awayBatterOrder =
    current.inningHalf === "top"
      ? nextOrder
      : wrapBatterOrder(current.awayBatterOrder ?? 1);
  const homeBatterOrder =
    current.inningHalf === "bottom"
      ? nextOrder
      : wrapBatterOrder(current.homeBatterOrder ?? 1);
  return {
    gameInning: current.gameInning,
    inningHalf: current.inningHalf,
    batterIndexInHalf: nextOrder,
    awayBatterOrder,
    homeBatterOrder,
  };
}

export function computeInningHalfSwitch(current: {
  gameInning: number;
  inningHalf: InningHalf;
  batterIndexInHalf?: number | null;
  awayBatterOrder?: number | null;
  homeBatterOrder?: number | null;
}) {
  const away = wrapBatterOrder(
    current.awayBatterOrder ?? (current.inningHalf === "top" ? current.batterIndexInHalf : 1),
  );
  const home = wrapBatterOrder(
    current.homeBatterOrder ?? (current.inningHalf === "bottom" ? current.batterIndexInHalf : 1),
  );
  if (current.inningHalf === "top") {
    return {
      gameInning: current.gameInning,
      inningHalf: "bottom" as InningHalf,
      batterIndexInHalf: home,
      awayBatterOrder: away,
      homeBatterOrder: home,
    };
  }
  return {
    gameInning: current.gameInning + 1,
    inningHalf: "top" as InningHalf,
    batterIndexInHalf: away,
    awayBatterOrder: away,
    homeBatterOrder: home,
  };
}

/** 실황이 이미 다음 초/말 — 운영자 초/말·이닝을 실황에 맞춘다. */
export function computeInningHalfCatchUp(
  current: {
    gameInning: number;
    inningHalf: InningHalf;
    batterIndexInHalf?: number | null;
    awayBatterOrder?: number | null;
    homeBatterOrder?: number | null;
  },
  live: {
    gameInning: number;
    inningHalf: InningHalf;
    batterIndexInHalf?: number | null;
  },
) {
  const away = wrapBatterOrder(
    current.awayBatterOrder ?? (current.inningHalf === "top" ? current.batterIndexInHalf : 1),
  );
  const home = wrapBatterOrder(
    current.homeBatterOrder ?? (current.inningHalf === "bottom" ? current.batterIndexInHalf : 1),
  );
  const batterIndexInHalf = wrapBatterOrder(
    live.batterIndexInHalf ?? (live.inningHalf === "top" ? away : home),
  );
  return {
    gameInning: live.gameInning,
    inningHalf: live.inningHalf,
    batterIndexInHalf,
    awayBatterOrder: live.inningHalf === "top" ? batterIndexInHalf : away,
    homeBatterOrder: live.inningHalf === "bottom" ? batterIndexInHalf : home,
  };
}
