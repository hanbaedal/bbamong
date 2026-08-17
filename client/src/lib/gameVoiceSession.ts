/** 경기·세션 단위 음성 중복 방지 */

let firstPredictionOpenSpoken = false;

export function resetGameVoiceSession(): void {
  firstPredictionOpenSpoken = false;
}

/** 당일·경기 첫 예측 열림만 '경기가 시작되었습니다' */
export function consumeFirstPredictionOpen(): boolean {
  if (firstPredictionOpenSpoken) return false;
  firstPredictionOpenSpoken = true;
  return true;
}
