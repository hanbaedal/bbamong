/** 접속 인트로 — 빠몽이 타격 플립북 + 멘트 동기 */

export const INTRO_TAGLINE_TEXT =
  "문자 중계보다 빠른 직감! 빠던나인과 함께 다음 타자의 운명을 예측하세요.";

/** 음성 7.25초 + 앞뒤 여유. 프레임을 길게 잡아 눈의 부담을 줄인다 */
export const INTRO_BATTING_MS = 12700;

export const INTRO_FADE_MS = 500;

export const INTRO_CROSSFADE_MS = 220;

/** 첨부 구장 타석을 먼저 보여 준 뒤 14장 플립북으로 이어진다 */
export const INTRO_STADIUM_HOLD_MS = 780;

export const INTRO_SPLASH_MS = INTRO_BATTING_MS + INTRO_FADE_MS;

/**
 * 각 프레임이 끝나는 시각(ms). 14장.
 * 재생 순서 8–11은 파일 11→8, 10→9, 8→10, 9→11.
 */
export const INTRO_FRAME_END_MS = [
  1000, 1900, 2800, 3550, 4300, 5100, 5900, 6700, 7500, 8350, 9250, 10150, 11100, 12700,
] as const;

export const INTRO_FRAME_COUNT = INTRO_FRAME_END_MS.length;

/** 첨부 구장(2720×1536) 기준 — 홈플레이트 발에 14장 캔버스를 맞춘다 */
export const INTRO_STADIUM_ASPECT = 2720 / 1536;

export const INTRO_SPRITE_BOX = {
  left: "19.12%",
  top: "17.23%",
  width: "64.05%",
  height: "75.62%",
} as const;

export function introFrameIndexAt(ms: number): number {
  const t = Math.max(0, ms);
  for (let i = 0; i < INTRO_FRAME_END_MS.length; i++) {
    if (t < INTRO_FRAME_END_MS[i]) return i;
  }
  return INTRO_FRAME_END_MS.length - 1;
}

/**
 * `?intro=1` 인트로 다시 보기.
 * `introFrame=0` 구장 타석만, `1`–`14` 해당 타격 컷 고정.
 * 고정 컷이면 재생도 연다.
 */
export function parseIntroReplayQuery(search: string): {
  forceIntro: boolean;
  freezeFrame: number | undefined;
} {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  const freezeRaw = params.get("introFrame");
  let freezeFrame: number | undefined;
  if (freezeRaw != null && freezeRaw !== "") {
    const n = Number(freezeRaw);
    if (n === 0) freezeFrame = -1;
    else if (Number.isInteger(n) && n >= 1 && n <= INTRO_FRAME_COUNT) {
      freezeFrame = n - 1;
    }
  }
  const forceIntro = params.get("intro") === "1" || freezeFrame !== undefined;
  return { forceIntro, freezeFrame };
}
