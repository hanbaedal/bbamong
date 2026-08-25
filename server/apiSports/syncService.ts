import { randomUUID } from "crypto";
import { MatchModel, StadiumModel, PredictionModel, RoundStatisticsModel, getNextSequence } from "../UserStorage/db";
import { finalizeMatchEnd } from "../liveMatch/sideBetStorage";
import { broadcastManager } from "../liveMatch/broadcastManager";
import { addKstDays, getKstDateString, getKstDayRange } from "../utils/dateUtils";
import type {
  ApiSportsTodayGame,
  InningRunsMap,
  LiveScoreboard,
  MatchControlMode,
} from "@shared/apiSportsTypes";
import {
  isConfirmedPostponedMatch,
  isGameFinished,
  isGameLiveStatus,
  isGameNotStarted,
  isGamePostponedOrCancelled,
  normalizeApiStatusShort,
} from "@shared/apiSportsStatus";
import { isApiSyncEnabledForRegistrationOrder } from "../managerOperatorService";
import { LIVE_SCORE_NS_GATE_POLL_MS, LIVE_SCORE_SYNC_START_BEFORE_MS } from "./constants";
import {
  hasLiveInningProgress,
  isStaleFinishedScoreboard,
  isStalePostponedScoreboard,
  isMisclassifiedTerminalStatus,
} from "@shared/matchManagementStatus";
import { refreshMatchHeadToHeadIfDue } from "./h2hService";
import {
  API_PLACEHOLDER_STADIUM_NAME,
  formatKboTeamShortName,
  resolveVenueNameFromApiSportsGame,
} from "@shared/kboHomeStadium";
import { buildInningKey, resolveScoreboardForApiWrite } from "./liveScoreboardPolicy";
import { formatInningWithHalf, parseInningHalf, type InningHalf } from "@shared/gamePhaseTypes";
import {
  shouldKeepPollingCompletedKboGame,
  shouldTreatKboScoreboardAsFinal,
} from "@shared/kboGameComplete";
import {
  daumGameStartDate,
  daumTeamLogo,
  daumVenueName,
  fetchDaumKboGameList,
  type DaumListGame,
} from "../daumLive/daumHermesClient";
import { parseDaumLiveScoreboard } from "../daumLive/parseDaumLiveScoreboard";
import { resolveDaumLiveScoreboard } from "../daumLive/daumLiveScoreService";
import { refreshMatchSeasonContext } from "../daumLive/daumSeasonStatsService";

const MAX_DAILY_MATCHES = 5;

function daumTeamsUpdate(game: DaumListGame, scoreboard: LiveScoreboard) {
  return {
    daumGameId: Number(game.gameId),
    apiSportsHomeTeam: formatKboTeamShortName(scoreboard.homeTeamName),
    apiSportsAwayTeam: formatKboTeamShortName(scoreboard.awayTeamName),
    apiSportsHomeTeamLogo: daumTeamLogo(game.home) ?? scoreboard.homeTeamLogo ?? null,
    apiSportsAwayTeamLogo: daumTeamLogo(game.away) ?? scoreboard.awayTeamLogo ?? null,
  };
}

async function syncOperatorAccountForMatch(matchId: string): Promise<void> {
  try {
    const { syncOperatorAccountStatusForMatchId } = await import("../managerOperatorService");
    await syncOperatorAccountStatusForMatchId(matchId);
  } catch (error) {
    console.error(`[Operators] account status sync failed (${matchId}):`, error);
  }
}

/** 시작 30분 이상 전 — 오진입(시각 DB 오류 등) 잠금으로 보고 해제 가능 */
const PREGAME_SIDEBET_UNLOCK_BEFORE_MS = 30 * 60_000;

/**
 * 사이드벳 마감 플래그 결정.
 * - 진행·종료·이닝 시작 시 잠금
 * - 시작 30분 전보다 이른 오전 오진입만 잠금 해제
 * - 시작 임박·경과 후 API NS 지연이어도 한번 잠겼으면 유지
 */
export function resolveSideBetsLocked(input: {
  previouslyLocked?: boolean | null;
  predictionEnabled?: boolean | null;
  matchStatus: string;
  statusShort?: string | null;
  inning?: number | null;
  startTime?: Date | string | null;
  nowMs?: number;
}): boolean {
  const nowMs = input.nowMs ?? Date.now();
  const { matchStatus } = input;

  if (
    matchStatus === "ongoing" ||
    matchStatus === "completed" ||
    matchStatus === "cancelled"
  ) {
    return true;
  }
  if (input.inning != null) return true;
  if (isGameFinished(input.statusShort)) return true;

  if (matchStatus === "scheduled" && isGameNotStarted(input.statusShort)) {
    if (!input.previouslyLocked) return false;
    const startMs = input.startTime ? new Date(input.startTime).getTime() : Number.NaN;
    const nearOrPastStart =
      Number.isFinite(startMs) && nowMs >= startMs - PREGAME_SIDEBET_UNLOCK_BEFORE_MS;
    // 시작 임박·경과: 실경기 가능 — 잠금 유지 (NS 지연으로 사이드벳 재오픈 금지)
    if (nearOrPastStart) return true;
    // 오전 오진입만 해제
    return false;
  }

  return Boolean(input.previouslyLocked);
}

/**
 * DB ongoing + API 스코어보드 시작 전(NS) 고착을 scheduled로 복구.
 * 시작 30분보다 이른 오전 오진입만 대상 — 시작 임박·경과 ongoing은 유지.
 */
export async function reconcileStuckPregameOngoingStatuses(
  targetDate = getKstDateString(),
  nowMs = Date.now(),
): Promise<number> {
  const matches = await MatchModel.find({
    matchStatus: "ongoing",
    $or: [{ matchDate: targetDate }, { matchDate: null }],
  })
    .select("id matchDate liveScoreboard startTime predictionEnabled currentRound outsInHalf")
    .lean();

  let fixed = 0;
  for (const match of matches) {
    const matchDate =
      (match as { matchDate?: string | null }).matchDate ??
      (match.startTime ? getKstDateString(new Date(match.startTime)) : null);
    if (matchDate !== targetDate) continue;

    const startMs = match.startTime ? new Date(match.startTime).getTime() : Number.NaN;
    const earlyEnough =
      Number.isFinite(startMs) && nowMs < startMs - PREGAME_SIDEBET_UNLOCK_BEFORE_MS;
    if (!earlyEnough) continue;

    // 이미 예측·진행이 있으면 오진입이 아님
    if (match.predictionEnabled) continue;
    if ((match.currentRound ?? 1) > 1) continue;
    if ((match.outsInHalf ?? 0) > 0) continue;

    const sb = match.liveScoreboard as LiveScoreboard | null | undefined;
    const noLiveInning =
      !sb ||
      (sb.inning == null &&
        !hasLiveInningProgress({ inning: sb.inning, inningLabel: sb.inningLabel }));
    const pregameFeed = !sb || isGameNotStarted(sb.statusShort) || noLiveInning;
    if (!pregameFeed) continue;
    if (sb?.inning != null) continue;
    if (/\d+회/.test(sb?.inningLabel ?? "") && !/종료|연기|취소/.test(sb?.inningLabel ?? "")) {
      continue;
    }

    await MatchModel.updateOne({ id: match.id }, { $set: { matchStatus: "scheduled" } });
    await syncOperatorAccountForMatch(match.id);
    fixed += 1;
  }

  if (fixed > 0) {
    console.log(`[MatchStatus] reconciled ${fixed} ongoing→scheduled (API NS) on ${targetDate}`);
  }
  return fixed;
}

/** 오전 오진입 시계만 초기화 — 정산된 라운드·Prediction 이력은 삭제하지 않음 */
async function clearPregameRoundPredictionClocks(matchId: string): Promise<void> {
  await RoundStatisticsModel.updateMany(
    { matchId, isResultSent: { $ne: true } },
    {
      $set: {
        predictionStartTime: null,
        predictionStopTime: null,
        isPredictionStarted: false,
        isPredictionStopped: false,
      },
    },
  );
}

/**
 * 경기전(scheduled+NS)인데 sideBetsLocked/predictionEnabled가 고착된 경우 해제.
 * 시작 30분보다 이른 오전 오진입만 — 시작 임박·경과 경기는 wipe 금지.
 */
export async function reconcileStuckPregameSideBetLocks(
  targetDate = getKstDateString(),
  nowMs = Date.now(),
): Promise<number> {
  const matches = await MatchModel.find({
    matchStatus: "scheduled",
    $or: [{ matchDate: targetDate }, { matchDate: null }],
  })
    .select(
      "id matchDate liveScoreboard startTime sideBetsLocked predictionEnabled currentRound outsInHalf",
    )
    .lean();

  let fixed = 0;
  for (const match of matches) {
    const matchDate =
      (match as { matchDate?: string | null }).matchDate ??
      (match.startTime ? getKstDateString(new Date(match.startTime)) : null);
    if (matchDate !== targetDate) continue;

    const startMs = match.startTime ? new Date(match.startTime).getTime() : Number.NaN;
    const earlyEnough =
      Number.isFinite(startMs) && nowMs < startMs - PREGAME_SIDEBET_UNLOCK_BEFORE_MS;
    // 시작 임박·경과: 실경기 가능 — stats wipe·강제 unlock 금지
    if (!earlyEnough) continue;

    const sb = match.liveScoreboard as LiveScoreboard | null | undefined;
    if (!sb || !isGameNotStarted(sb.statusShort)) continue;
    if (sb.inning != null) continue;
    if ((match.outsInHalf ?? 0) > 0) continue;

    const settledOrLiveStats = await RoundStatisticsModel.exists({
      matchId: match.id,
      $or: [{ isResultSent: true }, { isPredictionStopped: true }],
    });
    if (settledOrLiveStats) continue;

    const hasSettledPrediction = await PredictionModel.exists({
      matchId: match.id,
      status: { $in: ["success", "fail"] },
    });
    if (hasSettledPrediction) continue;

    const needsUnlock =
      Boolean(match.sideBetsLocked) || Boolean(match.predictionEnabled);
    const hasStaleRoundClock = await RoundStatisticsModel.exists({
      matchId: match.id,
      $or: [
        { predictionStartTime: { $ne: null } },
        { predictionStopTime: { $ne: null } },
        { isPredictionStarted: true },
      ],
    });
    if (!needsUnlock && !hasStaleRoundClock && !((match.currentRound ?? 1) > 1)) {
      continue;
    }

    const $set: Record<string, unknown> = {
      sideBetsLocked: false,
      predictionEnabled: false,
    };
    if ((match.currentRound ?? 1) > 1) {
      $set.currentRound = 1;
    }

    await MatchModel.updateOne({ id: match.id }, { $set });
    await clearPregameRoundPredictionClocks(match.id);
    await syncOperatorAccountForMatch(match.id);
    fixed += 1;
  }

  if (fixed > 0) {
    console.log(
      `[MatchStatus] reconciled ${fixed} pregame sideBet/prediction locks on ${targetDate}`,
    );
  }
  return fixed;
}

function hasStartTimeReached(startTime?: Date | null): boolean {
  if (!startTime) return false;
  return Date.now() >= new Date(startTime).getTime();
}

/** api-sports 응답 + 시작 시각 기준으로 경기관리 DB 상태 결정 */
export function resolveMatchStatusFromScoreboard(
  currentStatus: string,
  scoreboard: LiveScoreboard,
  startTime?: Date | null,
): string {
  const staleInput = {
    matchStatus: currentStatus,
    statusShort: scoreboard.statusShort,
    statusLong: scoreboard.statusLong,
    homeScore: scoreboard.homeScore,
    awayScore: scoreboard.awayScore,
    inning: scoreboard.inning,
    inningLabel: scoreboard.inningLabel,
  };

  if (isConfirmedPostponedMatch(staleInput)) {
    return "cancelled";
  }

  if (isGamePostponedOrCancelled(scoreboard.statusShort)) {
    if (!isStalePostponedScoreboard(staleInput)) {
      return "cancelled";
    }
  } else if (currentStatus === "cancelled" && !isStalePostponedScoreboard(staleInput)) {
    return "cancelled";
  }

  if (isMisclassifiedTerminalStatus(staleInput)) {
    return "ongoing";
  }

  if (
    isGameFinished(scoreboard.statusShort) &&
    shouldTreatKboScoreboardAsFinal({
      statusShort: scoreboard.statusShort,
      inning: scoreboard.inning,
      inningHalf: scoreboard.inningHalf,
      homeScore: scoreboard.homeScore,
      awayScore: scoreboard.awayScore,
      homeInnings: scoreboard.homeInnings,
      awayInnings: scoreboard.awayInnings,
    }) &&
    !isStaleFinishedScoreboard(staleInput)
  ) {
    return "completed";
  }
  if (isGameLiveStatus(scoreboard.statusShort) || scoreboard.inning !== null) {
    const liveInning = hasLiveInningProgress({
      inning: scoreboard.inning,
      inningLabel: scoreboard.inningLabel,
    });
    if (!hasStartTimeReached(startTime) && !liveInning) {
      return "scheduled";
    }
    return "ongoing";
  }
  if (hasStartTimeReached(startTime)) {
    const totalRuns = (scoreboard.homeScore ?? 0) + (scoreboard.awayScore ?? 0);
    if (totalRuns > 0) return "ongoing";
  }
  // API가 시작 전(NS 등)이어도, 이미 ongoing + 시작 시각 경과면 강등하지 않음
  // (운영자 승격·실황 지연 시 scheduled 핑퐁 방지)
  if (isGameNotStarted(scoreboard.statusShort)) {
    if (currentStatus === "ongoing" && hasStartTimeReached(startTime)) {
      return "ongoing";
    }
    return "scheduled";
  }
  // API 상태 신호가 없으면 종료·취소만 유지하고, ongoing은 올리지/유지하지 않음
  if (!normalizeApiStatusShort(scoreboard.statusShort)) {
    if (currentStatus === "completed" || currentStatus === "cancelled") {
      return currentStatus;
    }
    return "scheduled";
  }
  return currentStatus === "ongoing" ? "ongoing" : "scheduled";
}

async function ensureStadiumByName(name: string): Promise<number> {
  const trimmed = name.trim() || API_PLACEHOLDER_STADIUM_NAME;
  const existing = await StadiumModel.findOne({ name: trimmed }).lean();
  if (existing) return existing.id;

  for (let attempt = 0; attempt < 8; attempt++) {
    const id = await getNextSequence("stadium");
    const idTaken = await StadiumModel.findOne({ id }).lean();
    if (idTaken) continue;
    try {
      await StadiumModel.create({ id, name: trimmed });
      return id;
    } catch (error) {
      const again = await StadiumModel.findOne({ name: trimmed }).lean();
      if (again) return again.id;
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === 7) {
        throw new Error(`구장 생성 실패: ${trimmed} (${message})`);
      }
    }
  }
  throw new Error(`구장 생성 실패: ${trimmed}`);
}

function extractMatchOrder(name: string): number {
  const match = name.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function dayRangeForMatchDate(targetDate: string): { startOfDay: Date; endOfDay: Date } {
  const { start, end } = getKstDayRange(new Date(`${targetDate}T12:00:00+09:00`));
  return { startOfDay: start, endOfDay: end };
}

async function findMatchesForDate(targetDate: string) {
  const { startOfDay, endOfDay } = dayRangeForMatchDate(targetDate);
  return MatchModel.find({
    $or: [{ matchDate: targetDate }, { matchDate: null, startTime: { $gte: startOfDay, $lte: endOfDay } }],
  }).lean();
}

/** 같은 날·같은 registrationOrder(또는 N경기) 중복 제거 — 예측 없는 orphan만 삭제 */
async function dedupeDailyMatchesForDate(
  targetDate: string,
  activeApiIds: Set<number>,
): Promise<number> {
  const matches = await findMatchesForDate(targetDate);
  const groups = new Map<number, typeof matches>();

  for (const m of matches) {
    const order =
      (m as { registrationOrder?: number | null }).registrationOrder ??
      extractMatchOrder(m.name) ??
      0;
    if (order < 1) continue;
    const list = groups.get(order) ?? [];
    list.push(m);
    groups.set(order, list);
  }

  let removed = 0;

  for (const group of groups.values()) {
    if (group.length <= 1) continue;

    const ranked = [...group].sort((a, b) => {
      const aDaum = (a as { daumGameId?: number | null }).daumGameId;
      const bDaum = (b as { daumGameId?: number | null }).daumGameId;
      const aActive = aDaum != null && activeApiIds.has(aDaum) ? 1 : 0;
      const bActive = bDaum != null && activeApiIds.has(bDaum) ? 1 : 0;
      if (bActive !== aActive) return bActive - aActive;
      const aHas = aDaum != null ? 1 : 0;
      const bHas = bDaum != null ? 1 : 0;
      if (bHas !== aHas) return bHas - aHas;
      return String(a.id).localeCompare(String(b.id));
    });

    const [, ...dupes] = ranked;
    for (const dup of dupes) {
      const predCount = await PredictionModel.countDocuments({ matchId: dup.id });
      if (predCount > 0) continue;
      await MatchModel.deleteOne({ id: dup.id });
      removed += 1;
    }
  }

  if (removed > 0) {
    console.log(`[MatchSync] ${targetDate} 중복 경기 ${removed}건 정리`);
  }

  return removed;
}

/** API에 해당일 경기 없음(forceApi) — 예측 없는 1~5경기 슬롯 orphan 제거 */
async function clearOrphanMatchesForDate(targetDate: string): Promise<number> {
  const matches = await findMatchesForDate(targetDate);
  let removed = 0;

  for (const m of matches) {
    const order =
      (m as { registrationOrder?: number | null }).registrationOrder ??
      extractMatchOrder(m.name) ??
      0;
    if (order < 1 || order > MAX_DAILY_MATCHES) continue;

    const predCount = await PredictionModel.countDocuments({ matchId: m.id });
    if (predCount > 0) continue;

    await MatchModel.deleteOne({ id: m.id });
    removed += 1;
  }

  if (removed > 0) {
    console.log(`[MatchSync] ${targetDate} 다음 경기 없음 — orphan ${removed}건 제거`);
  }

  return removed;
}

function venueNameFromDaumGame(game: DaumListGame, scoreboard: LiveScoreboard): string {
  return resolveVenueNameFromApiSportsGame({
    apiVenueName: daumVenueName(game),
    homeTeamName: scoreboard.homeTeamName,
  });
}

function formatDaumClock(game: DaumListGame): string {
  const digits = String(game.startTime ?? "").replace(/\D/g, "").padStart(4, "0").slice(0, 4);
  if (digits.length !== 4) return "";
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

export function mapTodayGames(games: DaumListGame[], matchDate: string): ApiSportsTodayGame[] {
  return games
    .slice()
    .sort((a, b) => daumGameStartDate(a, matchDate).getTime() - daumGameStartDate(b, matchDate).getTime())
    .map((game) => {
      const scoreboard = parseDaumLiveScoreboard(game);
      const daumGameId = Number(game.gameId);
      return {
        apiSportsGameId: daumGameId,
        daumGameId,
        date: matchDate,
        time: formatDaumClock(game),
        homeTeamName: scoreboard.homeTeamName,
        awayTeamName: scoreboard.awayTeamName,
        statusShort: scoreboard.statusShort,
        statusLong: scoreboard.statusLong,
        homeScore: scoreboard.homeScore,
        awayScore: scoreboard.awayScore,
        venueName: venueNameFromDaumGame(game, scoreboard),
      };
    });
}

/**
 * 해당일 KBO 일정을 다음 스포츠에서 읽어 DB에 자동 등록(최대 5경기)하고 연결합니다.
 */
export async function syncTodayGamesFromApiSports(
  date?: string,
  options?: { forceApi?: boolean; skipExisting?: boolean },
): Promise<{
  created: number;
  updated: number;
  linked: number;
  deduped: number;
  cleared?: number;
  games: ApiSportsTodayGame[];
  source: "daum";
}> {
  const targetDate = date ?? getKstDateString();
  const isPastDate = targetDate < getKstDateString();
  const daumGames = await fetchDaumKboGameList(targetDate.replace(/-/g, ""));
  const sorted = daumGames
    .slice()
    .sort(
      (a, b) => daumGameStartDate(a, targetDate).getTime() - daumGameStartDate(b, targetDate).getTime(),
    )
    .slice(0, MAX_DAILY_MATCHES);
  const mapped = mapTodayGames(sorted, targetDate);

  if (sorted.length === 0) {
    const cleared =
      options?.forceApi === true ? await clearOrphanMatchesForDate(targetDate) : 0;
    return { created: 0, updated: 0, linked: 0, deduped: 0, cleared, games: [], source: "daum" };
  }

  const activeDaumIds = new Set(
    sorted.map((game) => Number(game.gameId)).filter((id) => Number.isFinite(id) && id > 0),
  );
  const dedupedBefore = await dedupeDailyMatchesForDate(targetDate, activeDaumIds);

  const { startOfDay, endOfDay } = dayRangeForMatchDate(targetDate);

  const internalMatches = await MatchModel.find({
    $or: [{ matchDate: targetDate }, { matchDate: null, startTime: { $gte: startOfDay, $lte: endOfDay } }],
  }).lean();

  const byDaumId = new Map(
    internalMatches
      .filter((m) => (m as { daumGameId?: number | null }).daumGameId != null)
      .map((m) => [(m as { daumGameId: number }).daumGameId, m]),
  );
  const byRegistrationOrder = new Map(
    internalMatches
      .filter((m) => (m as { registrationOrder?: number | null }).registrationOrder != null)
      .map((m) => [(m as { registrationOrder: number }).registrationOrder, m]),
  );
  const byName = new Map(internalMatches.map((m) => [m.name, m]));
  const usedMatchIds = new Set<string>();

  const takeExisting = (
    ...candidates: Array<(typeof internalMatches)[number] | null | undefined>
  ) => {
    for (const candidate of candidates) {
      if (!candidate?.id || usedMatchIds.has(candidate.id)) continue;
      return candidate;
    }
    return null;
  };

  let created = 0;
  let updated = 0;
  let linked = 0;

  for (let i = 0; i < sorted.length; i++) {
    const external = sorted[i];
    const scoreboard = parseDaumLiveScoreboard(external);
    const daumGameId = Number(external.gameId);
    const matchName = `${i + 1}경기`;
    const startTime = daumGameStartDate(external, targetDate);
    const endTime = new Date(startTime.getTime() + 4 * 60 * 60 * 1000);
    const stadiumId = await ensureStadiumByName(venueNameFromDaumGame(external, scoreboard));

    const order = i + 1;
    const existing = takeExisting(
      byDaumId.get(daumGameId),
      byRegistrationOrder.get(order),
      byName.get(matchName),
    );
    if (existing) usedMatchIds.add(existing.id);

    if (options?.skipExisting && existing?.daumGameId === daumGameId) {
      linked += 1;
      continue;
    }

    const resolvedStatus = resolveMatchStatusFromScoreboard(
      existing?.matchStatus ?? "scheduled",
      scoreboard,
      startTime,
    );
    const staleFinished = isStaleFinishedScoreboard({
      matchStatus: existing?.matchStatus,
      statusShort: scoreboard.statusShort,
      homeScore: scoreboard.homeScore,
      awayScore: scoreboard.awayScore,
      inning: scoreboard.inning,
      inningLabel: scoreboard.inningLabel,
    });
    const stalePostponed = isStalePostponedScoreboard({
      matchStatus: existing?.matchStatus,
      statusShort: scoreboard.statusShort,
      statusLong: scoreboard.statusLong,
      homeScore: scoreboard.homeScore,
      awayScore: scoreboard.awayScore,
      inning: scoreboard.inning,
      inningLabel: scoreboard.inningLabel,
    });
    const useFreshScoreboard =
      options?.forceApi ||
      isPastDate ||
      staleFinished ||
      stalePostponed ||
      isGameFinished(scoreboard.statusShort) ||
      isGamePostponedOrCancelled(scoreboard.statusShort) ||
      isGameNotStarted(scoreboard.statusShort) ||
      !existing?.liveScoreboard ||
      typeof existing.liveScoreboard.homeScore !== "number" ||
      typeof existing.liveScoreboard.awayScore !== "number" ||
      existing.matchStatus !== "ongoing";

    const daumChanged = existing?.daumGameId !== daumGameId;
    const payload = {
      name: matchName,
      stadiumId,
      matchDate: targetDate,
      startTime,
      endTime,
      matchStatus: resolvedStatus,
      registrationOrder: order,
      ...daumTeamsUpdate(external, scoreboard),
      liveScoreboard: useFreshScoreboard ? scoreboard : existing!.liveScoreboard,
      lastInningKey: existing?.lastInningKey ?? buildInningKey(scoreboard),
      controlMode: existing?.controlMode ?? "auto",
      ...(daumChanged ? { matchHeadToHead: null } : {}),
      sideBetsLocked: resolveSideBetsLocked({
        previouslyLocked: existing?.sideBetsLocked,
        predictionEnabled: existing?.predictionEnabled,
        matchStatus: resolvedStatus,
        statusShort: scoreboard.statusShort,
        inning: scoreboard.inning,
        startTime,
      }),
    };

    if (existing) {
      await MatchModel.updateOne({ id: existing.id }, payload);
      updated += 1;
      linked += 1;
      byDaumId.set(daumGameId, { ...existing, ...payload });
      byRegistrationOrder.set(order, { ...existing, ...payload });
      byName.set(matchName, { ...existing, ...payload });
      void refreshMatchHeadToHeadIfDue(existing.id).catch((error) => {
        console.warn(`[H2H] sync ${existing.id}:`, error);
      });
      void refreshMatchSeasonContext(existing.id).catch((error) => {
        console.warn(`[SeasonStats] sync ${existing.id}:`, error);
      });
    } else {
      const createdId = randomUUID();
      await MatchModel.create({
        id: createdId,
        currentRound: 1,
        predictionEnabled: false,
        ...payload,
      });
      created += 1;
      linked += 1;
      void refreshMatchHeadToHeadIfDue(createdId).catch((error) => {
        console.warn(`[H2H] sync ${createdId}:`, error);
      });
      void refreshMatchSeasonContext(createdId).catch((error) => {
        console.warn(`[SeasonStats] sync ${createdId}:`, error);
      });
    }
  }

  const dedupedAfter = await dedupeDailyMatchesForDate(targetDate, activeDaumIds);

  return {
    created,
    updated,
    linked,
    deduped: dedupedBefore + dedupedAfter,
    games: mapped,
    source: "daum",
  };
}

function currentSeasonYear(): number {
  const fromEnv = Number(process.env.KBO_SEASON || process.env.API_SPORTS_SEASON || "");
  if (Number.isFinite(fromEnv) && fromEnv > 2000) return fromEnv;
  return Number(getKstDateString().slice(0, 4));
}

function seasonRangeStart(season: number): string {
  const mmdd = process.env.MATCH_MGMT_SEASON_START_MM_DD || "03-01";
  return `${season}-${mmdd}`;
}

function seasonRangeEnd(season: number): string {
  const mmdd = process.env.MATCH_MGMT_SEASON_END_MM_DD || "10-31";
  return `${season}-${mmdd}`;
}

const SEASON_IMPORT_DAY_DELAY_MS = Math.max(
  0,
  parseInt(process.env.MATCH_MGMT_SEASON_IMPORT_DELAY_MS || "80", 10) || 80,
);

/**
 * 시즌 전체(기본 3/1~10/31) 날짜별 Match DB 등록 — 경기관리 달력용 (다음 스포츠)
 */
export async function importSeasonMatchesFromApiSports(
  season?: number,
  options?: { prefetchScheduleCache?: boolean; forceApi?: boolean },
): Promise<{
  season: number;
  daysChecked: number;
  daysSynced: number;
  daysEmpty: number;
  daysFromApi: number;
  created: number;
  updated: number;
  linked: number;
}> {
  const targetSeason = season ?? currentSeasonYear();
  void options?.prefetchScheduleCache;

  let cursor = seasonRangeStart(targetSeason);
  const end = seasonRangeEnd(targetSeason);

  let daysChecked = 0;
  let daysSynced = 0;
  let daysEmpty = 0;
  let created = 0;
  let updated = 0;
  let linked = 0;

  while (cursor <= end) {
    daysChecked += 1;

    const result = await syncTodayGamesFromApiSports(cursor, {
      forceApi: options?.forceApi ?? true,
    });

    if (result.games.length === 0) {
      daysEmpty += 1;
    } else {
      daysSynced += 1;
      created += result.created;
      updated += result.updated;
      linked += result.linked;
    }

    if (SEASON_IMPORT_DAY_DELAY_MS > 0) {
      await new Promise((resolve) => setTimeout(resolve, SEASON_IMPORT_DAY_DELAY_MS));
    }

    cursor = addKstDays(cursor, 1);
  }

  console.log(
    `[MatchMgmt] season ${targetSeason} Match import: days ${daysSynced}/${daysChecked}, created ${created}, updated ${updated}`,
  );

  return {
    season: targetSeason,
    daysChecked,
    daysSynced,
    daysEmpty,
    daysFromApi: daysSynced,
    created,
    updated,
    linked,
  };
}

/**
 * 2026(시즌) 오늘 이전 날짜 — DB에 없으면 api-sports(캐시 우선)로 Match 등록, 있으면 패스
 */
export async function backfillSeasonMatchesBeforeToday(season?: number): Promise<{
  season: number;
  daysSkipped: number;
  daysFilled: number;
  daysEmpty: number;
  created: number;
}> {
  const targetSeason = season ?? currentSeasonYear();
  const today = getKstDateString();
  let cursor = seasonRangeStart(targetSeason);

  let daysSkipped = 0;
  let daysFilled = 0;
  let daysEmpty = 0;
  let created = 0;

  while (cursor < today) {
    const existingCount = await MatchModel.countDocuments({
      matchDate: cursor,
      $or: [{ daumGameId: { $ne: null } }, { apiSportsGameId: { $ne: null } }],
    });

    const staleCount =
      existingCount > 0
        ? await MatchModel.countDocuments({
            matchDate: cursor,
            $or: [{ daumGameId: { $ne: null } }, { apiSportsGameId: { $ne: null } }],
            matchStatus: { $in: ["scheduled", "ongoing"] },
          })
        : 0;

    if (existingCount > 0 && staleCount === 0) {
      daysSkipped += 1;
      cursor = addKstDays(cursor, 1);
      continue;
    }

    let result = await syncTodayGamesFromApiSports(cursor, {
      forceApi: staleCount > 0 || existingCount === 0,
      skipExisting: false,
    });

    if (result.games.length === 0) {
      result = await syncTodayGamesFromApiSports(cursor, {
        forceApi: true,
        skipExisting: false,
      });
    }

    if (result.games.length === 0) {
      daysEmpty += 1;
    } else {
      daysFilled += 1;
      created += result.created;
    }

    cursor = addKstDays(cursor, 1);
  }

  console.log(
    `[MatchMgmtSchedule] backfill ${targetSeason} before ${today}: skip ${daysSkipped}, fill ${daysFilled}, empty ${daysEmpty}, created ${created}`,
  );

  return { season: targetSeason, daysSkipped, daysFilled, daysEmpty, created };
}

/** 최근 N일 — scheduled/ongoing으로 남은 과거 경기 스코어·상태 API 갱신 */
export async function refreshStalePastMatchScores(lookbackDays = 14): Promise<{
  daysRefreshed: number;
  updated: number;
}> {
  const today = getKstDateString();
  let daysRefreshed = 0;
  let updated = 0;

  for (let i = 1; i <= lookbackDays; i++) {
    const date = addKstDays(today, -i);
    const staleCount = await MatchModel.countDocuments({
      matchDate: date,
      $or: [{ daumGameId: { $ne: null } }, { apiSportsGameId: { $ne: null } }],
      matchStatus: { $in: ["scheduled", "ongoing"] },
    });
    if (staleCount === 0) continue;

    const result = await syncTodayGamesFromApiSports(date, { forceApi: true });
    daysRefreshed += 1;
    updated += result.updated;
    console.log(
      `[MatchMgmtSchedule] stale refresh ${date}: updated ${result.updated}, linked ${result.linked}`,
    );
  }

  return { daysRefreshed, updated };
}

/** ② 경기 시작 시각 — 다음 스포츠 실황 1회 (운영자 실황 연동 ON일 때만) */
export async function refreshMatchFromApiAtStart(matchId: string): Promise<void> {
  const match = await MatchModel.findOne({ id: matchId }).lean();
  if (!match) return;
  if (match.matchStatus === "completed" || match.matchStatus === "cancelled") return;

  const order = match.registrationOrder ?? 0;
  if (order >= 1 && order <= MAX_DAILY_MATCHES && !(await isApiSyncEnabledForRegistrationOrder(order))) {
    return;
  }

  try {
    const daum = await resolveDaumLiveScoreboard(match);
    if (daum) {
      await persistIncomingLiveScoreboard(match, daum.scoreboard, { daumGameId: daum.daumGameId });
      void refreshMatchSeasonContext(matchId).catch((error) => {
        console.warn(`[MatchMgmtSchedule] start season stats ${matchId}:`, error);
      });
      console.log(`[MatchMgmtSchedule] start ${match.name} (${matchId}) → daum`);
      return;
    }
  } catch (error) {
    console.warn(`[MatchMgmtSchedule] start daum ${matchId}:`, error);
  }
}

/** ③ 경기 종료 시각 — 다음 스포츠 스코어 1회 (운영자 실황 연동 ON일 때만) */
export async function refreshMatchFromApiAtEnd(matchId: string): Promise<void> {
  const match = await MatchModel.findOne({ id: matchId }).lean();
  if (!match) return;
  if (match.matchStatus === "completed" || match.matchStatus === "cancelled") return;

  const order = match.registrationOrder ?? 0;
  if (order >= 1 && order <= MAX_DAILY_MATCHES && !(await isApiSyncEnabledForRegistrationOrder(order))) {
    return;
  }

  try {
    const daum = await resolveDaumLiveScoreboard(match);
    if (!daum) return;
    const previousStatus = match.matchStatus ?? "scheduled";
    const shouldStop = await persistIncomingLiveScoreboard(match, daum.scoreboard, {
      daumGameId: daum.daumGameId,
    });
    console.log(
      `[MatchMgmtSchedule] end ${match.name} (${matchId}) → daum${shouldStop ? " stop" : ""} (was ${previousStatus})`,
    );
  } catch (error) {
    console.warn(`[MatchMgmtSchedule] end daum ${matchId}:`, error);
  }
}

function isWithinLiveSyncWindow(startTime?: Date | null, nowMs = Date.now()): boolean {
  if (!startTime) return false;
  const startMs = new Date(startTime).getTime();
  if (!Number.isFinite(startMs)) return false;
  return nowMs >= startMs - LIVE_SCORE_SYNC_START_BEFORE_MS;
}

/** live sync 창(시작 5분 전~) 안에서만 — 진행 중 2.5초, NS·scheduled는 60초 간격 시작 감지 */
function shouldFetchLiveScoreFromApi(
  match: {
    matchStatus?: string | null;
    startTime?: Date | null;
    liveScoreboard?: { statusShort?: string | null; syncedAt?: string | null } | null;
  },
  nowMs = Date.now(),
): boolean {
  if (!isWithinLiveSyncWindow(match.startTime, nowMs)) return false;

  if (match.matchStatus === "ongoing") return true;
  if (isGameLiveStatus(match.liveScoreboard?.statusShort)) return true;

  if (
    match.matchStatus === "scheduled" &&
    isGameNotStarted(match.liveScoreboard?.statusShort)
  ) {
    const syncedAt = match.liveScoreboard?.syncedAt;
    if (!syncedAt) return true;
    return nowMs - new Date(syncedAt).getTime() >= LIVE_SCORE_NS_GATE_POLL_MS;
  }

  return true;
}

/**
 * live sync — 다음 스포츠 실황만 저장
 * 해당 registrationOrder 슬롯 운영자 실황 연동 ON일 때만 호출
 * @returns true면 live sync 중단(종료·취소·연동 OFF·대상 아님)
 */
async function persistIncomingLiveScoreboard(
  match: {
    id: string;
    name?: string;
    matchStatus?: string | null;
    controlMode?: string | null;
    liveScoreboard?: LiveScoreboard | null;
    startTime?: Date | null;
    sideBetsLocked?: boolean | null;
    predictionEnabled?: boolean | null;
    currentRound?: number | null;
    lastInningKey?: string | null;
  },
  incoming: LiveScoreboard,
  extra: Record<string, unknown> = {},
): Promise<boolean> {
  const matchId = match.id;
  const scoreboard = resolveScoreboardForApiWrite(
    {
      controlMode: match.controlMode,
      matchStatus: match.matchStatus,
      liveScoreboard: match.liveScoreboard,
    },
    incoming,
  );
  const previousStatus = match.matchStatus ?? "scheduled";
  const nextStatus = resolveMatchStatusFromScoreboard(previousStatus, incoming, match.startTime);
  const notStarted = isGameNotStarted(incoming.statusShort);
  const nextKey = buildInningKey(scoreboard);

  await MatchModel.updateOne(
    { id: matchId },
    {
      matchStatus: nextStatus,
      liveScoreboard: scoreboard,
      lastInningKey: nextKey,
      sideBetsLocked: resolveSideBetsLocked({
        previouslyLocked: match.sideBetsLocked,
        predictionEnabled: match.predictionEnabled,
        matchStatus: nextStatus,
        statusShort: incoming.statusShort,
        inning: incoming.inning,
        startTime: match.startTime,
      }),
      ...extra,
    },
  );

  await syncOperatorAccountForMatch(matchId);

  const prevSit = match.liveScoreboard?.situation;
  const nextSit = scoreboard.situation;
  const situationChanged =
    (prevSit?.batterName ?? "") !== (nextSit?.batterName ?? "") ||
    (prevSit?.outs ?? -1) !== (nextSit?.outs ?? -1) ||
    (prevSit?.balls ?? -1) !== (nextSit?.balls ?? -1) ||
    (prevSit?.strikes ?? -1) !== (nextSit?.strikes ?? -1) ||
    Boolean(prevSit?.first) !== Boolean(nextSit?.first) ||
    Boolean(prevSit?.second) !== Boolean(nextSit?.second) ||
    Boolean(prevSit?.third) !== Boolean(nextSit?.third) ||
    (prevSit?.pitcherName ?? "") !== (nextSit?.pitcherName ?? "") ||
    (prevSit?.pitchLabel ?? "") !== (nextSit?.pitchLabel ?? "") ||
    (prevSit?.suggestedResult ?? "") !== (nextSit?.suggestedResult ?? "") ||
    (prevSit?.atBatResultDisplay ?? "") !== (nextSit?.atBatResultDisplay ?? "") ||
    (prevSit?.pitchLocations?.length ?? 0) !== (nextSit?.pitchLocations?.length ?? 0);

  if (nextKey !== (match.lastInningKey ?? null) || situationChanged) {
    broadcastManager.sendToMatch(matchId, "scoreboard_update", { scoreboard });
  }

  if (nextStatus === "ongoing") {
    void runLiveAutoAfterPersist(matchId, scoreboard);
  }

  if (notStarted && nextStatus === "scheduled") {
    return false;
  }

  if (nextStatus === "completed" && previousStatus !== "completed") {
    if (match.predictionEnabled) {
      console.log(
        `[LiveScoreSync] defer complete ${match.name} (${matchId}) — prediction still open`,
      );
      return false;
    }
    const openRound = await RoundStatisticsModel.findOne({
      matchId,
      roundNumber: match.currentRound,
      isPredictionStarted: true,
      isResultSent: false,
    })
      .select("id")
      .lean();
    if (openRound) {
      console.log(
        `[LiveScoreSync] defer complete ${match.name} (${matchId}) — round result not sent`,
      );
      return false;
    }

    const { match: ended } = await finalizeMatchEnd(matchId);
    broadcastManager.sendToMatch(matchId, "end", {
      matchId,
      message: "경기가 종료되었습니다.",
      matchStatus: ended.matchStatus,
    });
    console.log(`[LiveScoreSync] ${ended.name} (${matchId}) → completed`);
    return true;
  }

  if (nextStatus === "cancelled" || isGamePostponedOrCancelled(scoreboard.statusShort)) {
    console.log(`[LiveScoreSync] ${match.name} (${matchId}) → cancelled/postponed`);
    return true;
  }

  if (isGameFinished(scoreboard.statusShort) && shouldTreatKboScoreboardAsFinal({
    statusShort: scoreboard.statusShort,
    inning: scoreboard.inning,
    inningHalf: scoreboard.inningHalf,
    homeScore: scoreboard.homeScore,
    awayScore: scoreboard.awayScore,
    homeInnings: scoreboard.homeInnings,
    awayInnings: scoreboard.awayInnings,
  })) return true;
  return false;
}

async function runLiveAutoAfterPersist(
  matchId: string,
  scoreboard: LiveScoreboard,
): Promise<void> {
  try {
    const { processLiveAutoOperator } = await import("../liveMatch/liveAutoOperator");
    await processLiveAutoOperator(matchId, scoreboard);
  } catch (error) {
    console.warn(`[LiveAuto] process failed ${matchId}:`, error);
  }
}

export async function refreshMatchLiveScoreFromApi(matchId: string): Promise<boolean> {
  const match = await MatchModel.findOne({ id: matchId }).lean();
  if (!match) return true;
  if (match.matchStatus === "cancelled") return true;
  if (match.matchStatus === "completed") {
    const sb = match.liveScoreboard as LiveScoreboard | null | undefined;
    if (
      !shouldKeepPollingCompletedKboGame({
        homeScore: sb?.homeScore,
        awayScore: sb?.awayScore,
        inning: sb?.inning,
        statusShort: sb?.statusShort,
        homeInnings: sb?.homeInnings,
        awayInnings: sb?.awayInnings,
      })
    ) {
      return true;
    }
  }

  const order = match.registrationOrder ?? 99;
  if (order < 1 || order > 5) return true;

  const apiSyncEnabled = await isApiSyncEnabledForRegistrationOrder(order);
  if (!apiSyncEnabled) {
    const { clearLiveAutoOperator } = await import("../liveMatch/liveAutoOperator");
    clearLiveAutoOperator(matchId);
    console.log(
      `[LiveScoreSync] tick skipped ${matchId} (order=${order}) — 운영자 API 폴링 OFF → auto state cleared`,
    );
    return true;
  }

  if (!shouldFetchLiveScoreFromApi(match)) {
    return false;
  }

  try {
    const daum = await resolveDaumLiveScoreboard(match);
    if (daum) {
      const shouldStop = await persistIncomingLiveScoreboard(match, daum.scoreboard, {
        daumGameId: daum.daumGameId,
      });
      void refreshMatchSeasonContext(matchId).catch((error) => {
        console.warn(`[LiveScoreSync] season stats ${matchId}:`, error);
      });
      void refreshMatchHeadToHeadIfDue(matchId).catch((error) => {
        console.warn(`[LiveScoreSync] h2h ${matchId}:`, error);
      });
      return shouldStop;
    }
  } catch (error) {
    console.warn(`[LiveScoreSync] daum tick failed (${matchId}):`, error);
  }

  console.warn(`[LiveScoreSync] daum miss ${matchId}`);
  return false;
}

export async function setMatchControlMode(matchId: string, mode: MatchControlMode) {
  const updated = await MatchModel.findOneAndUpdate(
    { id: matchId },
    { controlMode: mode },
    { new: true },
  ).lean();
  if (!updated) throw new Error("경기를 찾을 수 없습니다.");

  // auto 복귀 시 즉시 1회 동기화 시도 (다음 스포츠 실황)
  if (mode === "auto") {
    try {
      await refreshMatchLiveScoreFromApi(matchId);
    } catch (err) {
      console.warn(`[ControlMode] auto refresh ${matchId}:`, err);
    }
  }

  return await MatchModel.findOne({ id: matchId }).lean() ?? updated;
}

export type LiveScoreboardPatchInput = {
  homeScore?: number;
  awayScore?: number;
  homeHits?: number;
  awayHits?: number;
  homeErrors?: number;
  awayErrors?: number;
  homeWalks?: number;
  awayWalks?: number;
  homeInnings?: InningRunsMap;
  awayInnings?: InningRunsMap;
  inning?: number | null;
  inningHalf?: InningHalf | null;
  /** 기본 true — 보정 후 API가 점수를 다시 덮지 않도록 수동 잠금 */
  lockManual?: boolean;
  /** true면 운영자 gameInning/inningHalf 도 함께 맞춤 */
  syncOperatorPhase?: boolean;
};

/**
 * 운영자/관리자 스코어보드 수동 보정.
 * 기본적으로 controlMode=manual 로 잠가 이후 API 덮어쓰기를 막음.
 */
export async function patchMatchLiveScoreboard(matchId: string, patch: LiveScoreboardPatchInput) {
  const match = await MatchModel.findOne({ id: matchId }).lean();
  if (!match) throw new Error("경기를 찾을 수 없습니다.");

  const existing = (match.liveScoreboard as LiveScoreboard | null | undefined) ?? null;
  const awayName =
    existing?.awayTeamName ||
    (match as { apiSportsAwayTeam?: string }).apiSportsAwayTeam ||
    "원정팀";
  const homeName =
    existing?.homeTeamName ||
    (match as { apiSportsHomeTeam?: string }).apiSportsHomeTeam ||
    "홈팀";

  const nextInning =
    patch.inning !== undefined
      ? patch.inning
      : (existing?.inning ?? (match as { gameInning?: number }).gameInning ?? null);
  const nextHalfRaw =
    patch.inningHalf !== undefined
      ? patch.inningHalf
      : (existing?.inningHalf ?? (match as { inningHalf?: string }).inningHalf ?? null);
  const nextHalf = nextHalfRaw ? parseInningHalf(nextHalfRaw) : null;

  const merged: LiveScoreboard = {
    homeTeamName: homeName,
    awayTeamName: awayName,
    homeTeamLogo:
      existing?.homeTeamLogo ??
      (match as { apiSportsHomeTeamLogo?: string | null }).apiSportsHomeTeamLogo ??
      null,
    awayTeamLogo:
      existing?.awayTeamLogo ??
      (match as { apiSportsAwayTeamLogo?: string | null }).apiSportsAwayTeamLogo ??
      null,
    homeScore: patch.homeScore ?? existing?.homeScore ?? 0,
    awayScore: patch.awayScore ?? existing?.awayScore ?? 0,
    homeHits: patch.homeHits ?? existing?.homeHits ?? 0,
    awayHits: patch.awayHits ?? existing?.awayHits ?? 0,
    homeErrors: patch.homeErrors ?? existing?.homeErrors ?? 0,
    awayErrors: patch.awayErrors ?? existing?.awayErrors ?? 0,
    homeWalks: patch.homeWalks ?? existing?.homeWalks ?? 0,
    awayWalks: patch.awayWalks ?? existing?.awayWalks ?? 0,
    homeInnings: patch.homeInnings ?? existing?.homeInnings,
    awayInnings: patch.awayInnings ?? existing?.awayInnings,
    inning: nextInning,
    inningHalf: nextHalf,
    inningLabel:
      nextInning != null && nextHalf
        ? formatInningWithHalf(nextInning, nextHalf)
        : (existing?.inningLabel ?? ""),
    statusShort: existing?.statusShort ?? "IN",
    statusLong: existing?.statusLong ?? "In Progress",
    situation: existing?.situation ?? null,
    syncedAt: new Date().toISOString(),
  };

  const lockManual = patch.lockManual !== false;
  const update: Record<string, unknown> = {
    liveScoreboard: merged,
    lastInningKey: buildInningKey(merged),
  };
  update.controlMode = (lockManual ? "manual" : "auto") satisfies MatchControlMode;
  if (patch.syncOperatorPhase && nextInning != null && nextHalf) {
    update.gameInning = nextInning;
    update.inningHalf = nextHalf;
  }

  const updated = await MatchModel.findOneAndUpdate({ id: matchId }, update, { new: true }).lean();
  if (!updated) throw new Error("경기를 찾을 수 없습니다.");
  return updated;
}
