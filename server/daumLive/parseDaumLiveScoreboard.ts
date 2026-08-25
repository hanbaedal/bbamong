import type { InningRunsMap, LiveScoreboard } from "@shared/apiSportsTypes";
import { formatInningWithHalf, type InningHalf } from "@shared/gamePhaseTypes";
import { formatKboTeamShortName } from "@shared/kboHomeStadium";
import { shouldTreatKboScoreboardAsFinal } from "@shared/kboGameComplete";
import { reconcileTeamRuns } from "@shared/liveScoreTotals";
import { inferCurrentInningFromRuns, inferInningHalfFromRuns } from "@shared/matchPhaseDisplay";
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

const DAUM_PREGAME_STATUSES = new Set([
  "READY",
  "BEFORE",
  "SCHEDULED",
  "WAIT",
  "PRE",
  "NS",
  "TBD",
  "NOTSTARTED",
  "NOT_STARTED",
]);

const DAUM_LIVE_STATUSES = new Set(["PLAY", "LIVE", "INPLAY", "INGAME", "ING", "START", "STARTED"]);

export function parseDaumPeriod(
  periodType?: string | null,
): { inning: number | null; inningHalf: InningHalf | null; statusShort: string } {
  const raw = (periodType ?? "").trim().toUpperCase();
  const match = raw.match(/^([TB])(\d{1,2})$/);
  if (!match) {
    return { inning: null, inningHalf: null, statusShort: "" };
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
  if (!status || DAUM_PREGAME_STATUSES.has(status)) {
    return { statusShort: "NS", statusLong: "Not Started" };
  }
  if (DAUM_LIVE_STATUSES.has(status)) {
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
  return { statusShort: "NS", statusLong: "Not Started" };
}

function scoreTotals(block?: DaumScoreBlock): { run: number; hit: number; error: number; walks: number } {
  return {
    run: toInt(block?.run),
    hit: toInt(block?.hit),
    error: toInt(block?.error),
    walks: toInt(block?.ballfour),
  };
}

/**
 * 다음 스포츠 list.json → 점수·이닝·R/H/E/B 전용.
 * situation(주자·카운트)은 넣지 않는다 — 네이버 relay 가 주인.
 */
export function parseDaumLiveScoreboard(game: DaumListGame): LiveScoreboard {
  const period = parseDaumPeriod(game.periodType);
  const mapped = mapDaumGameStatus(game.gameStatus);
  const home = scoreTotals(game.homeScore);
  const away = scoreTotals(game.awayScore);
  const homeInnings = parseDaumInningRuns(game.homeScore?.inning);
  const awayInnings = parseDaumInningRuns(game.awayScore?.inning);
  const homeRun = reconcileTeamRuns(home.run, homeInnings);
  const awayRun = reconcileTeamRuns(away.run, awayInnings);
  const rawStatus = (game.gameStatus ?? "").trim().toUpperCase();
  const explicitPregame = DAUM_PREGAME_STATUSES.has(rawStatus);
  const isPregame = explicitPregame || (mapped.statusShort === "NS" && period.inning == null);
  let statusShort = mapped.statusShort;
  let inning = isPregame ? null : period.inning;
  let inningHalf = isPregame ? null : period.inningHalf;

  if (isPregame) {
    statusShort = "NS";
  } else if (
    period.inning != null &&
    period.statusShort &&
    mapped.statusShort !== "CAN" &&
    mapped.statusShort !== "PST" &&
    mapped.statusShort !== "SUSP"
  ) {
    // T9/B10 등 실황 period가 있으면 END/RESULT보다 이닝을 우선한다 (연장 진입)
    statusShort = period.statusShort;
  } else if (mapped.statusShort === "FT") {
    const inferredInning = inferCurrentInningFromRuns(awayInnings, homeInnings);
    const inferredHalf =
      inferredInning != null
        ? inferInningHalfFromRuns(inferredInning, awayInnings, homeInnings)
        : null;
    const asFinal = shouldTreatKboScoreboardAsFinal({
      statusShort: "FT",
      periodType: game.periodType,
      inning: inferredInning,
      inningHalf: inferredHalf,
      homeScore: homeRun,
      awayScore: awayRun,
      homeInnings,
      awayInnings,
    });
    if (!asFinal) {
      statusShort = "IN";
      inning = inferredInning;
      inningHalf = inferredHalf;
    }
  }

  const inningLabel =
    statusShort === "FT"
      ? "경기 종료"
      : isPregame || statusShort === "NS"
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
    homeScore: homeRun,
    awayScore: awayRun,
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
