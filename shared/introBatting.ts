/** 접속 인트로 — 빠몽이 타격 플립북 + 멘트 동기 */

export const INTRO_TAGLINE_TEXT = "실시간~ 야구 예측게임! 빠던나인!";

/** gTTS 「실시간~ 야구 예측게임! 빠던나인!」 실측 */
export const INTRO_BATTING_MS = 4320;

export const INTRO_FADE_MS = 400;

export const INTRO_SPLASH_MS = INTRO_BATTING_MS + INTRO_FADE_MS;

/** 각 프레임이 끝나는 시각(ms). 14장 = 스윙 6 + 타격 후 8 */
export const INTRO_FRAME_END_MS = [
  480, 880, 1280, 1700, 2150, 2550, 3000, 3160, 3320, 3480, 3640, 3800, 4000, 4320,
] as const;

/** 멘트 구간 끝: 실시간~ / 야구 예측게임! / 빠던나인! */
export const INTRO_PHRASE_END_MS = [1280, 3000, 4320] as const;

export const INTRO_FRAME_COUNT = INTRO_FRAME_END_MS.length;

export function introFrameIndexAt(ms: number): number {
  const t = Math.max(0, ms);
  for (let i = 0; i < INTRO_FRAME_END_MS.length; i++) {
    if (t < INTRO_FRAME_END_MS[i]) return i;
  }
  return INTRO_FRAME_END_MS.length - 1;
}

export function introCaptionAt(ms: number): string {
  if (ms < INTRO_PHRASE_END_MS[0]) return "실시간~";
  if (ms < INTRO_PHRASE_END_MS[1]) return "실시간~  야구 예측게임!";
  return INTRO_TAGLINE_TEXT;
}
