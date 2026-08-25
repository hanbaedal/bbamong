/** 접속 인트로 — 빠몽이 타격 플립북 + 멘트 동기 */

export const INTRO_TAGLINE_TEXT =
  "문자 중계보다 빠른 직감! 빠던나인과 함께 다음 타자의 운명을 예측하세요.";

/** 음성 7.25초 + 앞뒤 여유. 프레임을 길게 잡아 눈의 부담을 줄인다 */
export const INTRO_BATTING_MS = 12700;

export const INTRO_FADE_MS = 500;

export const INTRO_CROSSFADE_MS = 220;

export const INTRO_SPLASH_MS = INTRO_BATTING_MS + INTRO_FADE_MS;

/**
 * 각 프레임이 끝나는 시각(ms). 14장.
 * 준비(1–3)와 마지막 포즈를 길게, 스윙(4–6)만 조금 짧게.
 */
export const INTRO_FRAME_END_MS = [
  1000, 1900, 2800, 3550, 4300, 5100, 5900, 6700, 7500, 8350, 9250, 10150, 11100, 12700,
] as const;

export const INTRO_FRAME_COUNT = INTRO_FRAME_END_MS.length;

export function introFrameIndexAt(ms: number): number {
  const t = Math.max(0, ms);
  for (let i = 0; i < INTRO_FRAME_END_MS.length; i++) {
    if (t < INTRO_FRAME_END_MS[i]) return i;
  }
  return INTRO_FRAME_END_MS.length - 1;
}
