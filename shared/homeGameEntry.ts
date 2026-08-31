/** 홈 왼쪽 게임 입장 버튼 — 실시간 / 딜레이 / 친구방 */

export const HOME_LIVE_PREDICTION_LABEL = "실시간 예측게임";
export const HOME_DELAY_PREDICTION_LABEL = "딜레이 예측게임";
export const HOME_FRIEND_ROOM_LABEL = "친구·동호회 방";
export const HOME_DELAY_PREDICTION_SOON = "딜레이 예측게임은 준비 중입니다.";

const LEGACY_LIVE_LABELS = new Set([
  "예측게임 하러가기",
  "경기 참여하기",
  "게임하러가기",
]);

export function resolveHomeLivePredictionLabel(raw?: string | null): string {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text || LEGACY_LIVE_LABELS.has(text)) return HOME_LIVE_PREDICTION_LABEL;
  return text;
}
