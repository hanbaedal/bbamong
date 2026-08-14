import type { PinchHitterSnapshot } from "@shared/apiSportsTypes";
import { formatBattingAverage, formatOps, formatSeasonRate } from "@shared/batterDisplay";
import { MatchModel } from "../UserStorage/db";
import { getKboPlayersByIds, resolveMatchTeamShort } from "../kboRoster/kboRosterService";
import { ensureMatchLiveForOperatorControls } from "../liveMatch/predictionStorage";
import { lookupDaumBatterStats } from "../daumLive/daumSeasonStatsService";

export type PinchHitterInput = {
  playerName?: string;
  rosterPlayerId?: string;
  battingAverage?: string | number | null;
  hits?: number | null;
  homeRuns?: number | null;
  rbi?: number | null;
  ops?: string | number | null;
  position?: string | null;
  note?: string | null;
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
  await ensureMatchLiveForOperatorControls(matchId);
  const match = await MatchModel.findOne({ id: matchId })
    .select(
      "id startTime matchStatus batterIndexInHalf inningHalf gameInning apiSportsHomeTeam apiSportsAwayTeam liveScoreboard",
    )
    .lean();
  if (!match) throw new Error("경기를 찾을 수 없습니다.");

  const rosterId = input.rosterPlayerId?.trim();
  const roster = rosterId ? (await getKboPlayersByIds([rosterId]))[0] : null;
  if (rosterId && !roster) {
    throw new Error("선택한 선수를 선수단에서 찾을 수 없습니다.");
  }

  const playerName = (roster?.name || input.playerName || "").trim();
  if (!playerName) throw new Error("대타 선수를 선택하세요.");

  const season = resolveSeason(match.startTime as Date | undefined, input.season);
  const battingTeam =
    match.inningHalf === "bottom"
      ? resolveMatchTeamShort(match, "home")
      : resolveMatchTeamShort(match, "away");
  const daumStats = await lookupDaumBatterStats({
    name: playerName,
    teamShort: battingTeam,
    season,
  }).catch(() => null);

  const snapshot: PinchHitterSnapshot = {
    playerName,
    battingAverage:
      formatSeasonRate(daumStats?.battingAverage ?? roster?.battingAverage ?? input.battingAverage ?? null) ??
      formatBattingAverage(roster?.battingAverage ?? input.battingAverage ?? null),
    hits: daumStats?.hits ?? roster?.hits ?? (typeof input.hits === "number" && Number.isFinite(input.hits)
      ? Math.round(input.hits)
      : null),
    homeRuns:
      daumStats?.homeRuns ??
      roster?.homeRuns ??
      (typeof input.homeRuns === "number" && Number.isFinite(input.homeRuns)
        ? Math.round(input.homeRuns)
        : null),
    rbi:
      daumStats?.rbi ??
      roster?.rbi ??
      (typeof input.rbi === "number" && Number.isFinite(input.rbi) ? Math.round(input.rbi) : null),
    ops:
      formatSeasonRate(daumStats?.ops ?? roster?.ops ?? input.ops ?? null) ??
      formatOps(roster?.ops ?? input.ops ?? null),
    runs: daumStats?.runs ?? null,
    stolenBases: daumStats?.stolenBases ?? null,
    onBasePercentage: formatSeasonRate(daumStats?.onBasePercentage ?? null),
    position: roster?.position || input.position?.trim() || null,
    note: roster?.note || input.note?.trim() || null,
    rosterPlayerId: roster?.id,
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
