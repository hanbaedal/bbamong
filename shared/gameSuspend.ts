/**
 * 우천 지연·경기 중단(재개 가능) vs 우천 취소·연기(재개 없음).
 * matchStatus 는 ongoing/scheduled 를 유지하고, 예측만 멈춘다.
 */
import {
  isGameCancelledStatus,
  isGameFinished,
  isGamePostponedOrCancelled,
  isGameSuspendedStatus,
} from "./apiSportsStatus";

export const GAME_SUSPENDED_OPERATOR_MESSAGE =
  "경기가 우천 등으로 중단되었습니다. 재개 후 예측을 시작해 주세요.";

export const GAME_SUSPENDED_USER_TITLE = "경기 중단";
export const GAME_SUSPENDED_USER_SUBTITLE = "우천으로 경기가 중단되었습니다";
export const GAME_SUSPENDED_USER_HINT = "재개되면 운영자가 예측을 시작합니다";
export const GAME_RESUMED_USER_HINT = "경기가 재개되었습니다. 운영자 예측 시작을 기다려 주세요.";

const DELAY_TEXT =
  /우천.{0,12}(중단|지연)|경기.{0,6}중단|플레이가 중단|그라운드\s*커버|방수포|weather delay|rain delay|suspended/i;
const CANCEL_OVERRIDE = /우천\s*취소|콜드\s*게임/;

export function textIndicatesWeatherDelay(text?: string | null): boolean {
  const raw = (text ?? "").trim();
  if (!raw) return false;
  if (CANCEL_OVERRIDE.test(raw)) return false;
  return DELAY_TEXT.test(raw);
}

export type GameSuspendScoreboardInput = {
  statusShort?: string | null;
  statusLong?: string | null;
  inningLabel?: string | null;
};

/** 재개 가능한 중단. 취소·연기·종료는 false */
export function isGameSuspendedScoreboard(input: GameSuspendScoreboardInput): boolean {
  if (isGameCancelledStatus(input.statusShort) || isGameFinished(input.statusShort)) {
    return false;
  }
  if (
    isGamePostponedOrCancelled(input.statusShort) &&
    !isGameSuspendedStatus(input.statusShort)
  ) {
    return false;
  }
  if (isGameSuspendedStatus(input.statusShort)) return true;
  const label = (input.inningLabel ?? "").trim();
  if (label === "중단" || label === "경기 중단" || label === "지연") return true;
  return textIndicatesWeatherDelay(input.statusLong) || textIndicatesWeatherDelay(input.inningLabel);
}

export function isMatchPredictionSuspended(input: {
  matchStatus?: string | null;
  statusShort?: string | null;
  statusLong?: string | null;
  inningLabel?: string | null;
  liveScoreboard?: GameSuspendScoreboardInput | null;
}): boolean {
  if (input.matchStatus === "completed" || input.matchStatus === "cancelled") return false;
  return isGameSuspendedScoreboard({
    statusShort: input.statusShort ?? input.liveScoreboard?.statusShort,
    statusLong: input.statusLong ?? input.liveScoreboard?.statusLong,
    inningLabel: input.inningLabel ?? input.liveScoreboard?.inningLabel,
  });
}

/** 다음이 PLAY 인데 네이버 최근 문자가 우천 중단이면 예측 중지용 SUSP 로 올린다 */
export function applyWeatherDelayHint<T extends GameSuspendScoreboardInput>(
  board: T,
  delayHint: boolean,
): T {
  if (!delayHint) return board;
  if (isGameFinished(board.statusShort) || isGameCancelledStatus(board.statusShort)) {
    return board;
  }
  if (isGamePostponedOrCancelled(board.statusShort)) return board;
  if (isGameSuspendedStatus(board.statusShort)) return board;
  return { ...board, statusShort: "SUSP", statusLong: "Suspended" };
}

/** 네이버 문자중계 마지막 블록만 본다. 재개 후 새 투구가 오면 중단이 아니다 */
export function naverRelaysIndicateWeatherDelay(relays: unknown): boolean {
  if (!Array.isArray(relays) || relays.length === 0) return false;
  const last = relays[relays.length - 1] as {
    title?: string;
    textOptions?: Array<{ text?: string }>;
  };
  const chunk = [last?.title, ...(last?.textOptions ?? []).map((row) => row.text)]
    .filter((part): part is string => Boolean(part && String(part).trim()))
    .join(" ");
  return textIndicatesWeatherDelay(chunk);
}
