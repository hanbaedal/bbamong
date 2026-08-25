import { speakKorean } from "./speakKorean";

/** MP3: client/public/audio/intro-tagline.mp3 */
export const INTRO_TAGLINE_AUDIO_SRC = "/audio/intro-tagline.mp3";

export const INTRO_TAGLINE_TTS =
  "문자 중계보다 빠른 직감! 빠던나인과 함께 다음 타자의 운명을 예측하세요.";

export async function speakIntroTagline(): Promise<void> {
  if (typeof window === "undefined") return;
  await speakKorean(INTRO_TAGLINE_TTS, INTRO_TAGLINE_AUDIO_SRC);
}

export function stopIntroSpeech(): void {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
}
