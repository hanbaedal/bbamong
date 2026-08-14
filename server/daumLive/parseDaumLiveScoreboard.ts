import type { InningRunsMap, LiveScoreboard } from "@shared/apiSportsTypes";
import { formatInningWithHalf, type InningHalf } from "@shared/gamePhaseTypes";
import { formatKboTeamShortName } from "@shared/kboHomeStadium";
import {
  daumTeamLogo,
  daumTeamName,
  daumTeamShort,
  type DaumListGame,
  type DaumScoreBlock,
} from "./daumHermesClient";

function toInt(value: unknown): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : 0;
}

export function parseDaumInningRuns(raw?: string | null): InningRunsMap {
  const map: InningRunsMap = {};
  const parts = String(raw ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part, index, all) => !(part === "" && index === all.length - 1));
  parts.forEach((part, index) => {
    if (part === "") return;
    const n = Number.parseInt(part, 10);
    if (!Number.isFinite(n)) return;
    map[String(index + 1)] = n;
  });
  return map;
}

export function parseDaumPeriod(
  periodType?: string | null,
): { inning: number | null; inningHalf: InningHalf | null; statusShort: string } {
  const raw = (periodType ?? "").trim().toUpperCase();
  const match = raw.match(/^([TB])(\d{1,2})$/);
  if (!match) {
    return { inning: null, inningHalf: null, statusShort: raw || "IN" };
  }
  const inningHalf: InningHalf = match[1] === "B" ? "bottom" : "top";
  const inning = Number.parseInt(match[2], 10);
  return {
    inning: Number.isFinite(inning) ? inning : null,
    inningHalf,
    statusShort: `${match[1]}${Number.isFinite(inning) ? inning : ""}`,
  };
}

export function mapDaumGameStatus(gameStatus?: string | null): {
  statusShort: string;
  statusLong: string;
} {
  const status = (gameStatus ?? "").trim().toUpperCase();
  if (status === "READY") return { statusShort: "NS", statusLong: "Not Started" };
  if (status === "PLAY" || status === "LIVE" || status === "INPLAY") {
    return { statusShort: "IN", statusLong: "In Progress" };
  }
  if (status === "END" || status === "RESULT" || status === "FINAL" || status === "FINISHED") {
    return { statusShort: "FT", statusLong: "Game Finished" };
  }
  if (status === "CANCEL" || status === "CANCELED" || status === "CANCELLED") {
    return { statusShort: "CAN", statusLong: "Cancelled" };
  }
  if (status === "SUSPEND" || status === "SUSPENDED") {
    return { statusShort: "SUSP", statusLong: "Suspended" };
  }
  if (status === "DELAY" || status === "POSTPONE" || status === "POSTPONED") {
    return { statusShort: "PST", statusLong: "Postponed" };
  }
  return { statusShort: "IN", statusLong: "In Progress" };
}

function scoreTotals(block?: DaumScoreBlock): { run: number; hit: number; error: number; walks: number } {
  return {
    run: toInt(block?.run),
    hit: toInt(block?.hit),
    error: toInt(block?.error),
    walks: toInt(block?.ballfour),
  };
}

export function parseDaumLiveScoreboard(game: DaumListGame): LiveScoreboard {
  const period = parseDaumPeriod(game.periodType);
  const mapped = mapDaumGameStatus(game.gameStatus);
  const home = scoreTotals(game.homeScore);
  const away = scoreTotals(game.awayScore);
  const homeInnings = parseDaumInningRuns(game.homeScore?.inning);
  const awayInnings = parseDaumInningRuns(game.awayScore?.inning);
  const statusShort =
    mapped.statusShort === "IN" && period.statusShort ? period.statusShort : mapped.statusShort;
  const inning = mapped.statusShort === "NS" ? null : period.inning;
  const inningHalf = mapped.statusShort === "NS" ? null : period.inningHalf;
  const inningLabel =
    mapped.statusShort === "FT"
      ? "경기 종료"
      : mapped.statusShort === "NS"
        ? "시작 전"
        : inning != null && inningHalf
          ? formatInningWithHalf(inning, inningHalf)
          : inning != null
            ? `${inning}회`
            : mapped.statusLong;

  return {
    homeTeamName: formatKboTeamShortName(daumTeamShort(game.home) || daumTeamName(game.home)),
    awayTeamName: formatKboTeamShortName(daumTeamShort(game.away) || daumTeamName(game.away)),
    homeTeamLogo: daumTeamLogo(game.home),
    awayTeamLogo: daumTeamLogo(game.away),
    homeScore: home.run,
    awayScore: away.run,
    homeHits: home.hit,
    awayHits: away.hit,
    homeErrors: home.error,
    awayErrors: away.error,
    homeWalks: home.walks,
    awayWalks: away.walks,
    homeInnings,
    awayInnings,
    inning,
    inningHalf,
    inningLabel,
    statusShort,
    statusLong: mapped.statusLong,
    syncedAt: new Date().toISOString(),
  };
}
