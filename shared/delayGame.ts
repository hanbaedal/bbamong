/**
 * 딜레이 자동 예측 — 실시간 예측게임과 무관한 전용 상수·가드.
 * 실시간 AD_PLAY_MS / PREDICTION_AUTO_STOP / Match.predictionEnabled 를 쓰지 않는다.
 */

import { normalizeBatterName } from "./batterDisplay";
import type { LiveScoreboard } from "./apiSportsTypes";

export const DELAY_GAME_PATH = "/delay-prediction";

export const DELAY_PREDICTION_OPEN_MS = 8_000;
export const DELAY_BATTER_STABLE_MS = 2_000;
export const DELAY_RESULT_STABLE_MS = 12_000;
export const DELAY_AD_INTRO_MS = 5_000;
export const DELAY_AD_PLAY_MS = 40_000;
export const DELAY_AD_PLAY_SECONDS = Math.round(DELAY_AD_PLAY_MS / 1000);
export const DELAY_AD_BREAK_MS = DELAY_AD_INTRO_MS + DELAY_AD_PLAY_MS;
export const DELAY_AD_REWARD_POINTS = 500;

export const DELAY_LIVE_BLOCK_MESSAGE =
  "실시간 예측에 참여한 경기는 딜레이 예측에 참여할 수 없습니다.";

/** 스케줄러가 타석을 돌리는 경기 상태. 시작 전(scheduled) 선발 타자명으로는 창을 열지 않는다. */
export const DELAY_SCHEDULER_MATCH_STATUSES = ["ongoing"] as const;

export function isDelayMatchEnded(status?: string | null): boolean {
  const s = (status || "").trim();
  return s === "completed" || s === "cancelled" || s === "종료" || s === "취소";
}

export function isDelayMatchOngoing(status?: string | null): boolean {
  return (status || "").trim() === "ongoing";
}

export type DelayGamePhase = "idle" | "open" | "closed" | "ad" | "ended";

export type DelayAdReason = "switch_half" | "pitcher_change";

export type DelaySuggestedResult = "아웃" | "1루" | "2루" | "3루" | "홈런";

export function isDelaySuggestedResult(value: unknown): value is DelaySuggestedResult {
  return value === "아웃" || value === "1루" || value === "2루" || value === "3루" || value === "홈런";
}

export function delayUiStage(phase: DelayGamePhase): "wait" | "open" | "closed" | "result" {
  if (phase === "open") return "open";
  if (phase === "closed") return "closed";
  return "wait";
}

export function delayBatterKey(input: {
  inning?: number | null;
  half?: string | null;
  outs?: number | null;
  batterName?: string | null;
}): string {
  const inning = typeof input.inning === "number" ? input.inning : 0;
  const half = (input.half || "").trim() || "-";
  const outs =
    typeof input.outs === "number" && Number.isFinite(input.outs)
      ? String(Math.min(3, Math.max(0, Math.floor(input.outs))))
      : "-";
  const batter = (input.batterName || "").trim() || "-";
  return `${inning}:${half}:${outs}:${batter}`;
}

/** 공백 무시. 한쪽 이름이 비면 같은 타자로 보지 않는다. */
export function delaySameBatter(a?: string | null, b?: string | null): boolean {
  const left = normalizeBatterName(a || "");
  const right = normalizeBatterName(b || "");
  if (!left || !right) return false;
  return left === right;
}

/** 예측 창이 열린 동안 실황 타석 결과·구종 문구를 HUD에서 가린다. */
export function maskDelayOpenScoreboard(
  scoreboard: LiveScoreboard | null | undefined,
): LiveScoreboard | null {
  if (!scoreboard) return scoreboard ?? null;
  const sit = scoreboard.situation;
  if (!sit) return scoreboard;
  return {
    ...scoreboard,
    situation: {
      ...sit,
      suggestedResult: null,
      atBatResultDisplay: null,
      pitchLabel: null,
      pitchDetail: null,
      pitchLocations: null,
      batterToday: null,
    },
  };
}

export function delayHalfChanged(input: {
  prevInning?: number | null;
  prevHalf?: string | null;
  nextInning?: number | null;
  nextHalf?: string | null;
}): boolean {
  const prevInn = input.prevInning;
  const nextInn = input.nextInning;
  const prevHalf = (input.prevHalf || "").trim();
  const nextHalf = (input.nextHalf || "").trim();
  if (!prevHalf || !nextHalf) return false;
  if (typeof prevInn === "number" && typeof nextInn === "number" && prevInn !== nextInn) {
    return true;
  }
  return prevHalf !== nextHalf;
}

export function delayPitcherChanged(prev?: string | null, next?: string | null): boolean {
  const a = (prev || "").trim();
  const b = (next || "").trim();
  if (!a || !b) return false;
  return a !== b;
}

/** 딜레이 타석 카드 — 열린 라운드 타자를 우선, 없으면 실황 타자. */
export function resolveDelayBatterName(input: {
  delayBatterName?: string | null;
  liveBatterName?: string | null;
}): string | null {
  const delay = (input.delayBatterName || "").trim();
  if (delay) return delay;
  const live = (input.liveBatterName || "").trim();
  return live || null;
}
