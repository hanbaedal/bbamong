import { speakKorean } from "./speakKorean";

/** MP3: client/public/audio/intro-tagline.mp3 */
export const INTRO_TAGLINE_AUDIO_SRC = "/audio/intro-tagline.mp3";

export const INTRO_TAGLINE_TTS =
  "실시간으로 즐기는 야구 예측게임 ... 빠던나인!!!";

export async function speakIntroTagline(): Promise<void> {
  if (typeof window === "undefined") return;
  await speakKorean(INTRO_TAGLINE_TTS, INTRO_TAGLINE_AUDIO_SRC);
}

export function stopIntroSpeech(): void {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
}
