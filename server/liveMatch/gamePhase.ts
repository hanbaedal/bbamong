import type { InningHalf } from "@shared/gamePhaseTypes";

export function battingSideLabel(half: InningHalf): string {
  return half === "top" ? "원정팀 공격" : "홈팀 공격";
}

export function buildGamePhaseDisplay(input: {
  name: string;
  gameInning: number;
  inningHalf: InningHalf;
  batterIndexInHalf: number;
}): string {
  return `${input.name} · ${input.gameInning}회 · ${battingSideLabel(input.inningHalf)} · ${input.batterIndexInHalf}번째 타자`;
}

export function buildGamePhasePayload(match: {
  name: string;
  gameInning?: number | null;
  inningHalf?: string | null;
  batterIndexInHalf?: number | null;
  currentRound?: number;
}) {
  const gameInning = match.gameInning ?? 1;
  const inningHalf: InningHalf = match.inningHalf === "bottom" ? "bottom" : "top";
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
}) {
  return {
    gameInning: current.gameInning,
    inningHalf: current.inningHalf,
    batterIndexInHalf: current.batterIndexInHalf + 1,
  };
}

export function computeInningHalfSwitch(current: {
  gameInning: number;
  inningHalf: InningHalf;
}) {
  if (current.inningHalf === "top") {
    return { gameInning: current.gameInning, inningHalf: "bottom" as InningHalf, batterIndexInHalf: 1 };
  }
  return {
    gameInning: current.gameInning + 1,
    inningHalf: "top" as InningHalf,
    batterIndexInHalf: 1,
  };
}
