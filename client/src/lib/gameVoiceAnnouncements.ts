import { speakKorean } from "./speakKorean";

/** 음성 안내 키 — 텍스트·MP3 매핑 */
export type GameVoiceKey =
  | "user.predictionOpenFirst"
  | "user.predictionOpen"
  | "user.predictionClose"
  | "user.predictionSuccess"
  | "user.predictionFail"
  | "user.switchHalf"
  | "user.pitcherChange"
  | "user.pinchHitter"
  | "user.predictionCancelledPitcher"
  | "user.noMatch"
  | "user.postponed"
  | "user.cancelled"
  | "user.pregame"
  | "user.live"
  | "user.matchEnded"
  | "operator.threeOuts"
  | "operator.confirmResult"
  | "operator.startPrediction"
  | "operator.matchEnded";

export const GAME_VOICE_TEXT: Record<GameVoiceKey, string> = {
  "user.predictionOpenFirst":
    "경기가 시작되었습니다. 타자의 진루 예측을 눌러주세요",
  "user.predictionOpen": "타자의 진루 예측을 눌러주세요",
  "user.predictionClose":
    "타자가 타석에 들어 섰습니다. 타자의 진루 예측을 멈춥니다",
  "user.predictionSuccess": "타자의 진루 예측 성공을 축하합니다",
  "user.predictionFail": "아쉽습니다. 다음 타자를 기다려 주세요",
  "user.switchHalf": "공수교대를 합니다",
  "user.pitcherChange": "투수 교체를 합니다",
  "user.pinchHitter": "대타자가 나왔습니다",
  "user.predictionCancelledPitcher": "투수 교체로 예측이 취소되었습니다",
  "user.noMatch": "오늘은 경기가 없습니다",
  "user.postponed": "오늘의 경기가 연기되었습니다",
  "user.cancelled": "오늘의 경기가 취소되었습니다",
  "user.pregame": "오늘의 경기 시간이 안되었습니다",
  "user.live": "오늘의 경기가 진행 중입니다",
  "user.matchEnded": "오늘의 경기가 종료되었습니다",
  "operator.threeOuts": "3아웃 — 공수교대를 눌러주세요",
  "operator.confirmResult": "예측 결과를 확정하세요",
  "operator.startPrediction": "예측 시작을 눌러주세요",
  "operator.matchEnded": "경기가 종료되었습니다",
};

export const GAME_VOICE_CLIPS: Record<GameVoiceKey, string> = {
  "user.predictionOpenFirst": "/audio/voice-user-prediction-open-first.mp3",
  "user.predictionOpen": "/audio/voice-user-prediction-open.mp3",
  "user.predictionClose": "/audio/voice-user-prediction-close.mp3",
  "user.predictionSuccess": "/audio/voice-user-prediction-success.mp3",
  "user.predictionFail": "/audio/voice-user-prediction-fail.mp3",
  "user.switchHalf": "/audio/voice-user-switch-half.mp3",
  "user.pitcherChange": "/audio/voice-user-pitcher-change.mp3",
  "user.pinchHitter": "/audio/voice-user-pinch-hitter.mp3",
  "user.predictionCancelledPitcher": "/audio/voice-user-prediction-cancelled-pitcher.mp3",
  "user.noMatch": "/audio/voice-user-no-match.mp3",
  "user.postponed": "/audio/voice-user-postponed.mp3",
  "user.cancelled": "/audio/voice-user-cancelled.mp3",
  "user.pregame": "/audio/voice-user-pregame.mp3",
  "user.live": "/audio/voice-user-live.mp3",
  "user.matchEnded": "/audio/voice-user-match-ended.mp3",
  "operator.threeOuts": "/audio/voice-operator-three-outs.mp3",
  "operator.confirmResult": "/audio/voice-operator-confirm-result.mp3",
  "operator.startPrediction": "/audio/voice-operator-start-prediction.mp3",
  "operator.matchEnded": "/audio/voice-operator-match-ended.mp3",
};

const recentSpeakAt = new Map<GameVoiceKey, number>();

/** 같은 키가 짧은 시간에 중복 재생되지 않도록 */
export function speakGameVoice(key: GameVoiceKey, dedupMs = 0): Promise<void> {
  if (dedupMs > 0) {
    const now = Date.now();
    const last = recentSpeakAt.get(key) ?? 0;
    if (now - last < dedupMs) return Promise.resolve();
    recentSpeakAt.set(key, now);
  }
  return speakKorean(GAME_VOICE_TEXT[key], GAME_VOICE_CLIPS[key]);
}

/** @deprecated GameVoiceKey 사용 */
export const USER_GAME_VOICE = {
  predictionStarted: GAME_VOICE_TEXT["user.predictionOpenFirst"],
  predictionStopped: GAME_VOICE_TEXT["user.predictionClose"],
} as const;

/** @deprecated GameVoiceKey 사용 */
export const OPERATOR_GAME_VOICE = {
  threeOuts: GAME_VOICE_TEXT["operator.threeOuts"],
} as const;
