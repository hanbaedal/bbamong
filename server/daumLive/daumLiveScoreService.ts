import type { LiveScoreboard } from "@shared/apiSportsTypes";
import { getKstDateString } from "../utils/dateUtils";
import { resolveMatchTeamShort } from "../kboRoster/kboRosterService";
import { fetchDaumKboGameList, findDaumGameForMatch } from "./daumHermesClient";
import { parseDaumLiveScoreboard } from "./parseDaumLiveScoreboard";
import { fetchNaverLiveSituation } from "./naverRelayClient";
import { attachNaverSituation } from "../apiSports/liveScoreboardPolicy";
import { MatchModel } from "../UserStorage/db";

type MatchForDaum = {
  id: string;
  matchDate?: string | null;
  startTime?: Date | null;
  daumGameId?: number | null;
  apiSportsHomeTeam?: string | null;
  apiSportsAwayTeam?: string | null;
  liveScoreboard?: { homeTeamName?: string | null; awayTeamName?: string | null } | null;
};

function dateKeyForMatch(match: MatchForDaum): string {
  if (match.matchDate && /^\d{4}-\d{2}-\d{2}$/.test(match.matchDate)) return match.matchDate;
  if (match.startTime) return getKstDateString(match.startTime);
  return getKstDateString();
}

/** 다음 점수 보드에 네이버 타석만 붙인다. 네이버 실패 시 situation 을 null 로 덮지 않는다. */
export async function resolveDaumLiveScoreboard(match: MatchForDaum): Promise<{
  daumGameId: number;
  scoreboard: LiveScoreboard;
} | null> {
  const dateYmd = dateKeyForMatch(match).replace(/-/g, "");
  const games = await fetchDaumKboGameList(dateYmd);
  const found = findDaumGameForMatch(games, {
    daumGameId: match.daumGameId ?? null,
    homeTeam: resolveMatchTeamShort(match, "home"),
    awayTeam: resolveMatchTeamShort(match, "away"),
  });
  if (!found?.gameId) return null;
  const board = parseDaumLiveScoreboard(found);
  let situation: LiveScoreboard["situation"] | undefined;
  try {
    situation = (await fetchNaverLiveSituation(found.cpGameId)) ?? undefined;
  } catch (error) {
    console.warn("[DaumLive] naver situation failed:", error);
  }
  return {
    daumGameId: Number(found.gameId),
    scoreboard: attachNaverSituation(board, situation),
  };
}

export async function persistMatchDaumGameId(matchId: string, daumGameId: number): Promise<void> {
  if (!Number.isFinite(daumGameId) || daumGameId <= 0) return;
  await MatchModel.updateOne({ id: matchId }, { daumGameId });
}
