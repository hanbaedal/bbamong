import type { PinchHitterSnapshot } from "@shared/apiSportsTypes";
import { formatBattingAverage, formatOps } from "@shared/batterDisplay";
import { MatchModel } from "../UserStorage/db";

export type PinchHitterInput = {
  playerName: string;
  battingAverage?: string | number | null;
  hits?: number | null;
  homeRuns?: number | null;
  rbi?: number | null;
  ops?: string | number | null;
  season?: number;
};

function resolveSeason(startTime?: Date | string | null, fallback?: number): number {
  if (typeof fallback === "number" && Number.isFinite(fallback)) return fallback;
  if (startTime) {
    const y = new Date(startTime).getFullYear();
    if (Number.isFinite(y)) return y;
  }
  return new Date().getFullYear();
}

/** 현재 타석 대타 설정 — 예측 화면에 대타 안내·스탯 표시 */
export async function setMatchPinchHitter(
  matchId: string,
  input: PinchHitterInput,
): Promise<PinchHitterSnapshot> {
  const match = await MatchModel.findOne({ id: matchId })
    .select("id startTime matchStatus batterIndexInHalf inningHalf gameInning")
    .lean();
  if (!match) throw new Error("경기를 찾을 수 없습니다.");
  if (match.matchStatus !== "ongoing") {
    throw new Error("경기전에 대타를 설정할 수 없습니다.");
  }

  const playerName = input.playerName?.trim();
  if (!playerName) throw new Error("대타 이름을 입력하세요.");

  const season = resolveSeason(match.startTime as Date | undefined, input.season);
  const snapshot: PinchHitterSnapshot = {
    playerName,
    battingAverage: formatBattingAverage(input.battingAverage ?? null),
    hits:
      typeof input.hits === "number" && Number.isFinite(input.hits)
        ? Math.round(input.hits)
        : null,
    homeRuns:
      typeof input.homeRuns === "number" && Number.isFinite(input.homeRuns)
        ? Math.round(input.homeRuns)
        : null,
    rbi:
      typeof input.rbi === "number" && Number.isFinite(input.rbi) ? Math.round(input.rbi) : null,
    ops: formatOps(input.ops ?? null),
    season,
    batterIndexInHalf: (match.batterIndexInHalf as number | undefined) ?? 1,
    inningHalf: match.inningHalf === "bottom" ? "bottom" : "top",
    gameInning: (match.gameInning as number | undefined) ?? 1,
    setAt: new Date().toISOString(),
  };

  await MatchModel.updateOne({ id: matchId }, { $set: { pinchHitter: snapshot } });
  return snapshot;
}

/** 대타 해제 (다음 타자·공수교대 시) */
export async function clearMatchPinchHitter(matchId: string): Promise<void> {
  await MatchModel.updateOne({ id: matchId }, { $unset: { pinchHitter: 1 } });
}
