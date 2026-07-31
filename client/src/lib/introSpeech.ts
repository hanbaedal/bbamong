/** 나중에 MP3로 교체: client/public/audio/intro-tagline.mp3 */
export const INTRO_TAGLINE_AUDIO_SRC = "/audio/intro-tagline.mp3";

export const INTRO_TAGLINE_TTS =
  "실시간으로 즐기는 야구 예측게임 ... 빠던나인!!!";

function speakIntroTaglineTts(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }

    const finish = () => resolve();
    const timeout = window.setTimeout(finish, 4000);
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(INTRO_TAGLINE_TTS);
    utterance.lang = "ko-KR";
    utterance.rate = 0.92;
    utterance.pitch = 1.08;
    utterance.volume = 1;

    utterance.onend = () => {
      window.clearTimeout(timeout);
      finish();
    };
    utterance.onerror = () => {
      window.clearTimeout(timeout);
      finish();
    };

    window.speechSynthesis.speak(utterance);
  });
}

/** MP3 있으면 재생, 없으면 TTS 임시 사용 */
export async function speakIntroTagline(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const audio = new Audio(INTRO_TAGLINE_AUDIO_SRC);
    audio.volume = 1;
    await audio.play();
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      audio.addEventListener("ended", done, { once: true });
      audio.addEventListener("error", done, { once: true });
      window.setTimeout(done, 4500);
    });
  } catch {
    await speakIntroTaglineTts();
  }
}

export function stopIntroSpeech(): void {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
}
