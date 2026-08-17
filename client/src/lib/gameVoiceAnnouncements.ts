import { speakKorean } from "./speakKorean";

/** 사용자 예측 화면 음성 */
export const USER_GAME_VOICE = {
  predictionStarted: "경기가 시작되었습니다. 예측 시작을 눌러주세요",
  predictionStopped: "타자가 타석에 들어 섰습니다. 다음 타자 예측을 기다리세요",
} as const;

/** 운영자 경기 화면 음성 */
export const OPERATOR_GAME_VOICE = {
  threeOuts: "3아웃 — 공수교대를 눌러주세요",
} as const;

export const GAME_VOICE_CLIPS: Record<string, string> = {
  [USER_GAME_VOICE.predictionStarted]: "/audio/voice-prediction-started.mp3",
  [USER_GAME_VOICE.predictionStopped]: "/audio/voice-prediction-stopped.mp3",
  [OPERATOR_GAME_VOICE.threeOuts]: "/audio/voice-three-outs.mp3",
};

export function speakGameVoice(text: string): Promise<void> {
  return speakKorean(text, GAME_VOICE_CLIPS[text]);
}

export function resolveGameVoiceClip(text: string): string | undefined {
  return GAME_VOICE_CLIPS[text];
}
