import { speakKorean } from "./operatorLoginMessages";

/** 사용자 예측 화면 음성 */
export const USER_GAME_VOICE = {
  predictionStarted: "경기가 시작되었습니다. 예측 시작을 눌러주세요",
  predictionStopped: "타자가 타석에 들어 섰습니다. 다음 타자 예측을 기다리세요",
} as const;

/** 운영자 경기 화면 음성 */
export const OPERATOR_GAME_VOICE = {
  threeOuts: "3아웃 — 공수교대를 눌러주세요",
} as const;

export function speakGameVoice(text: string): Promise<void> {
  return speakKorean(text);
}
