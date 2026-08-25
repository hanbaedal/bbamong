import { AD_INTRO_DELAY_MS } from "@shared/adBreakTiming";

export type PredictionOption = "1루" | "2루" | "3루" | "홈런" | "아웃";

/** round_next WS — 라운드 진행 사유 */
export type RoundAdvanceType = "next_batter" | "pitcher_change" | "switch_half";

export type GameScreenPhase =
  | "wait_start"
  | "picking"
  | "wait_result"
  /** 예측 중지 화면에서 라운드 결과(1루·아웃 등) 큰 글씨 */
  | "result_flash"
  | "success_announce"
  | "success_running"
  | "success_celebrate"
  | "fail"
  | "pitcher_change_event"
  | "inning_switch_event"
  | "ad_playing"
  | "match_ended";

export type PredictionResult = "pending" | "success" | "fail";

/** 투수 교체·공수 교대 연출 표시 시간 (= 서버 광고 인트로 지연) */
export const GAME_EVENT_SHOW_MS = AD_INTRO_DELAY_MS;

/** 경기종료 연출 */
export const MATCH_ENDED_SHOW_MS = 10_000;

/** 주루 후 「예측 성공」 배너 (레거시 타이머 — 배트 연출이 먼저) */
export const SUCCESS_ANNOUNCE_MS = 2000;

/** 주루 도착 후 제자리 점프 3회 (레거시 — 단계표에서 사용 안 함) */
export const SUCCESS_HOP_MS = 1350;

/** 3번 화면에서 예측 결과 큰 글씨 표시 (너무 짧으면 체감상 “결과 없음”) */
export const RESULT_FLASH_MS = 2_200;

/** 자리비움 따라잡기 — 다음 타석 예측 창을 남기기 위한 짧은 결과 배너 */
export const CATCHUP_RESULT_MS = 700;

export function isPageHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

export function isSuccessPresentationPhase(phase: GameScreenPhase): boolean {
  return (
    phase === "success_announce" ||
    phase === "success_running" ||
    phase === "success_celebrate"
  );
}

/** 결과 확정 이후 연출(큰 글씨·주루·레거시 실패 포함) */
export function isOutcomePresentationPhase(phase: GameScreenPhase): boolean {
  return (
    phase === "result_flash" ||
    isSuccessPresentationPhase(phase) ||
    phase === "fail"
  );
}

/** 투수/공수 안내·광고 — 복귀 /check 가 이 연출을 대기/피킹으로 덮지 않음 */
export function isTransientAdOrEventPhase(phase: GameScreenPhase): boolean {
  return (
    phase === "pitcher_change_event" ||
    phase === "inning_switch_event" ||
    phase === "ad_playing"
  );
}

/** WS/정산 결과 → 화면 큰 글씨용 (병살·삼살은 서버에서 이미 아웃으로 올 수 있음) */
export function normalizeRoundResultLabel(raw?: string | null): PredictionOption | null {
  const r = (raw ?? "").trim();
  if (r === "1루" || r === "2루" || r === "3루" || r === "홈런" || r === "아웃") return r;
  if (r === "병살" || r === "삼살") return "아웃";
  return null;
}

/** 사용자에게 보여줄 타격 결과 — 실황 세분 문구 우선, 운영자 버킷은 폴백 */
export function displayRoundResultLabel(
  settleResult?: string | null,
  liveDisplay?: string | null,
): string | null {
  const live = (liveDisplay ?? "").trim();
  if (live) return live;
  const settle = (settleResult ?? "").trim();
  if (!settle) return null;
  if (settle === "병살" || settle === "삼살") return "아웃";
  return settle;
}
