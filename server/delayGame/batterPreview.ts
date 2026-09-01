import type {
  CurrentBatterPreview,
  LiveScoreboard,
  MatchLineupSnapshot,
  MatchPlayerStatsEntry,
  PinchHitterSnapshot,
} from "@shared/apiSportsTypes";
import { resolveDelayBatterName } from "@shared/delayGame";
import { parseInningHalf } from "@shared/gamePhaseTypes";
import { normalizeBatterName } from "@shared/batterDisplay";
import { buildCurrentBatterPreviewFromMatch } from "../apiSports/lineupService";

export function overlayDelayBatterBatsSide(
  batter: CurrentBatterPreview,
  liveBatterName?: string | null,
  batsSide?: "left" | "right" | null,
): CurrentBatterPreview {
  if (batsSide !== "left" && batsSide !== "right") return batter;
  const live = normalizeBatterName(liveBatterName || "");
  const name = normalizeBatterName(batter.playerName || "");
  if (live && name && live !== name) return batter;
  return { ...batter, batsSide };
}

/** 딜레이 HUD 시즌 기록 — 실시간 scoreboard와 같은 라인업·다음 타격 랭킹을 읽기만 한다. */
export function buildDelayCurrentBatter(input: {
  startTime?: Date | string | null;
  inningHalf?: string | null;
  batterIndexInHalf?: number | null;
  matchLineup?: MatchLineupSnapshot | null;
  matchPlayerStats?: Record<string, MatchPlayerStatsEntry> | null;
  pinchHitter?: PinchHitterSnapshot | null;
  delayBatterName?: string | null;
  delayHalf?: string | null;
  liveScoreboard?: LiveScoreboard | null;
}): CurrentBatterPreview | null {
  const liveBatterName = input.liveScoreboard?.situation?.batterName ?? null;
  const previewName = resolveDelayBatterName({
    delayBatterName: input.delayBatterName,
    liveBatterName,
  });
  if (!previewName) return null;

  const inningHalf = parseInningHalf(
    input.delayHalf || input.liveScoreboard?.inningHalf || input.inningHalf,
  );
  const preview = buildCurrentBatterPreviewFromMatch(
    {
      id: "delay",
      startTime: input.startTime ? new Date(input.startTime) : undefined,
      batterIndexInHalf: input.batterIndexInHalf ?? 1,
      inningHalf,
      matchLineup: input.matchLineup ?? null,
      matchPlayerStats: input.matchPlayerStats ?? null,
      pinchHitter: input.pinchHitter ?? null,
      liveBatterName: previewName,
    },
    inningHalf,
  );
  const withSide = overlayDelayBatterBatsSide(
    preview,
    liveBatterName,
    input.liveScoreboard?.situation?.batsSide ?? null,
  );
  return withSide.playerName?.trim() ? withSide : null;
}
