import { MatchModel } from "../UserStorage/db";
import { broadcastManager } from "../liveMatch/broadcastManager";
import { endMatch } from "../liveMatch/predictionStorage";
import { getKstDateString } from "../utils/dateUtils";
import { fetchGameById, fetchGamesByDate, type ApiSportsGameResponse } from "./client";
import { KBO_LEAGUE_ID } from "./constants";
import { markApiSportsError } from "./healthState";
import {
  buildInningKey,
  isGameFinished,
  parseLiveScoreboard,
} from "./scoreboardParser";
import type { ApiSportsTodayGame } from "@shared/apiSportsTypes";

function extractMatchNumber(name: string): number {
  const match = name.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

export function mapTodayGames(games: ApiSportsGameResponse[]): ApiSportsTodayGame[] {
  return games
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((game) => {
      const scoreboard = parseLiveScoreboard(game);
      return {
        apiSportsGameId: game.id,
        date: game.date,
        time: game.time,
        homeTeamName: game.teams.home.name,
        awayTeamName: game.teams.away.name,
        statusShort: game.status.short,
        statusLong: game.status.long,
        homeScore: scoreboard.homeScore,
        awayScore: scoreboard.awayScore,
      };
    });
}

export async function syncTodayGamesFromApiSports(date?: string): Promise<{
  linked: number;
  games: ApiSportsTodayGame[];
}> {
  const targetDate = date ?? getKstDateString();
  const apiGames = await fetchGamesByDate(targetDate, KBO_LEAGUE_ID);
  const mapped = mapTodayGames(apiGames);

  const today = new Date(`${targetDate}T12:00:00`);
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const internalMatches = await MatchModel.find({
    $or: [{ matchDate: targetDate }, { matchDate: null, startTime: { $gte: startOfDay, $lte: endOfDay } }],
  }).lean();

  const sortedInternal = internalMatches.sort(
    (a, b) => extractMatchNumber(a.name) - extractMatchNumber(b.name),
  );

  let linked = 0;
  for (let i = 0; i < Math.min(sortedInternal.length, mapped.length, 5); i++) {
    const internal = sortedInternal[i];
    const external = mapped[i];
    await MatchModel.updateOne(
      { id: internal.id },
      {
        apiSportsGameId: external.apiSportsGameId,
        apiSportsHomeTeam: external.homeTeamName,
        apiSportsAwayTeam: external.awayTeamName,
      },
    );
    linked += 1;
  }

  return { linked, games: mapped };
}

async function handleInningChange(matchId: string, scoreboard: ReturnType<typeof parseLiveScoreboard>) {
  broadcastManager.sendToMatch(matchId, "inning_change", {
    matchId,
    scoreboard,
    message: "이닝 변경이 감지되었습니다.",
  });

  broadcastManager.scheduleAdStart(matchId, 0);
  broadcastManager.sendToMatch(matchId, "rewarded_ad_offer", {
    matchId,
    rewardPoints: 500,
    rewardKey: buildInningKey(scoreboard),
    dismissGraceSeconds: 5,
    message: "공수교대 광고를 시청하면 500포인트를 받을 수 있습니다.",
  });
}

async function syncLinkedMatch(match: any) {
  if (!match.apiSportsGameId) return;

  const game = await fetchGameById(match.apiSportsGameId);
  if (!game) return;

  const scoreboard = parseLiveScoreboard(game);
  const inningKey = buildInningKey(scoreboard);
  const previousKey = match.lastInningKey as string | null | undefined;
  const controlMode = match.controlMode ?? "auto";

  await MatchModel.updateOne(
    { id: match.id },
    {
      liveScoreboard: scoreboard,
      apiSportsHomeTeam: scoreboard.homeTeamName,
      apiSportsAwayTeam: scoreboard.awayTeamName,
      lastInningKey: inningKey,
      matchStatus:
        isGameFinished(scoreboard.statusShort) && match.matchStatus !== "completed"
          ? "completed"
          : match.matchStatus === "scheduled" && scoreboard.inning !== null
            ? "ongoing"
            : match.matchStatus,
    },
  );

  broadcastManager.sendToMatch(match.id, "scoreboard_update", {
    matchId: match.id,
    scoreboard,
  });

  if (
    controlMode === "auto" &&
    previousKey &&
    previousKey !== inningKey &&
    scoreboard.inning !== null
  ) {
    await handleInningChange(match.id, scoreboard);
  }

  if (controlMode === "auto" && isGameFinished(scoreboard.statusShort) && match.matchStatus !== "completed") {
    const ended = await endMatch(match.id);
    broadcastManager.sendToMatch(match.id, "match_ended", {
      matchId: match.id,
      message: "API-SPORTS 기준 경기가 종료되었습니다.",
      matchStatus: ended.matchStatus,
    });
  }
}

export async function pollLinkedMatchesOnce(): Promise<void> {
  if (!process.env.API_SPORTS_KEY?.trim()) return;

  const kstToday = getKstDateString();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const matches = await MatchModel.find({
    apiSportsGameId: { $ne: null },
    matchStatus: { $nin: ["completed", "cancelled"] },
    $or: [{ matchDate: kstToday }, { matchDate: null, startTime: { $gte: today, $lt: tomorrow } }],
  }).lean();

  for (const match of matches) {
    try {
      await syncLinkedMatch(match);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown sync error";
      markApiSportsError(message);
      console.error(`[ApiSportsSync] match ${match.id} failed:`, message);
    }
  }
}

export async function setMatchControlMode(matchId: string, mode: "auto" | "manual") {
  const updated = await MatchModel.findOneAndUpdate(
    { id: matchId },
    { controlMode: mode },
    { new: true },
  ).lean();
  if (!updated) throw new Error("경기를 찾을 수 없습니다.");
  return updated;
}

export async function linkMatchToApiSports(matchId: string, apiSportsGameId: number) {
  const game = await fetchGameById(apiSportsGameId);
  if (!game) throw new Error("API-SPORTS 경기를 찾을 수 없습니다.");

  const scoreboard = parseLiveScoreboard(game);
  const updated = await MatchModel.findOneAndUpdate(
    { id: matchId },
    {
      apiSportsGameId,
      apiSportsHomeTeam: scoreboard.homeTeamName,
      apiSportsAwayTeam: scoreboard.awayTeamName,
      liveScoreboard: scoreboard,
      lastInningKey: buildInningKey(scoreboard),
    },
    { new: true },
  ).lean();

  if (!updated) throw new Error("경기를 찾을 수 없습니다.");
  return updated;
}
