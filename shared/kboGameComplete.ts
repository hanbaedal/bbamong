import { isGameFinished, isGameLiveStatus } from "./apiSportsStatus";
import type { InningRunsMap } from "./apiSportsTypes";
import { inferCurrentInningFromRuns, inferInningHalfFromRuns } from "./matchPhaseDisplay";
import type { InningHalf } from "./gamePhaseTypes";

/** KBO 정규 이닝 */
export const KBO_REGULATION_INNINGS = 9;
/** 연장 한도 — 12회까지 동점이면 무승부 가능 */
export const KBO_MAX_INNINGS = 12;

/** 다음 스포츠 periodType: T9 / B10 등 — 아직 그 이닝이 진행(또는 직전 표기) */
export function isDaumLivePeriodType(periodType?: string | null): boolean {
  return /^[TB]\d{1,2}$/i.test((periodType ?? "").trim());
}

export function parseDaumLivePeriodType(
  periodType?: string | null,
): { inning: number; inningHalf: InningHalf } | null {
  const raw = (periodType ?? "").trim().toUpperCase();
  const match = raw.match(/^([TB])(\d{1,2})$/);
  if (!match) return null;
  const inning = Number.parseInt(match[2]!, 10);
  if (!Number.isFinite(inning) || inning <= 0) return null;
  return { inning, inningHalf: match[1] === "B" ? "bottom" : "top" };
}

/**
 * 다음이 9회 종료 직후 END를 주고 연장(10회~)으로 넘어가는 경우가 있다.
 * 동점이면 연장이 가능하므로 종료로 보지 않는다.
 */
export function shouldTreatKboScoreboardAsFinal(input: {
  statusShort?: string | null;
  periodType?: string | null;
  inning?: number | null;
  inningHalf?: InningHalf | null;
  homeScore?: number | null;
  awayScore?: number | null;
  homeInnings?: InningRunsMap | null;
  awayInnings?: InningRunsMap | null;
}): boolean {
  if (isDaumLivePeriodType(input.periodType)) return false;
  if (isGameLiveStatus(input.statusShort)) return false;
  if (!isGameFinished(input.statusShort)) return false;

  const fromPeriod = parseDaumLivePeriodType(input.periodType);
  const inferred = inferCurrentInningFromRuns(input.awayInnings, input.homeInnings);
  const inning = fromPeriod?.inning ?? input.inning ?? inferred;
  const half =
    fromPeriod?.inningHalf ??
    input.inningHalf ??
    (inning != null
      ? inferInningHalfFromRuns(inning, input.awayInnings, input.homeInnings)
      : null);
  const home = input.homeScore ?? 0;
  const away = input.awayScore ?? 0;
  const tied = home === away;

  if (tied && (inning == null || inning < KBO_MAX_INNINGS)) return false;
  if (inning != null && inning < KBO_REGULATION_INNINGS) return false;
  // 9회초: 홈이 지고 있거나 동점이면 말 이닝이 남는다
  if (inning === KBO_REGULATION_INNINGS && half === "top" && home <= away) return false;
  return true;
}

/** 이미 completed로 찍혀도 동점·연장 가능성이 있으면 실황 폴링을 유지한다 */
export function shouldKeepPollingCompletedKboGame(input: {
  homeScore?: number | null;
  awayScore?: number | null;
  inning?: number | null;
  statusShort?: string | null;
  periodType?: string | null;
  homeInnings?: InningRunsMap | null;
  awayInnings?: InningRunsMap | null;
}): boolean {
  if (isDaumLivePeriodType(input.periodType) || isGameLiveStatus(input.statusShort)) {
    return true;
  }
  const inferred = inferCurrentInningFromRuns(input.awayInnings, input.homeInnings);
  const inning = parseDaumLivePeriodType(input.periodType)?.inning ?? input.inning ?? inferred;
  const tied = (input.homeScore ?? 0) === (input.awayScore ?? 0);
  if (tied && (inning == null || inning < KBO_MAX_INNINGS)) return true;
  // 이미 연장 이닝표가 있으면 종료 오인 가능성이 있어 폴링을 유지한다
  return inning != null && inning > KBO_REGULATION_INNINGS;
}
