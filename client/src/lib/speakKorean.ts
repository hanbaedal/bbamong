import {
  getSharedGameAudio,
  isMobileAudioUnlocked,
  unlockMobileAudio,
  whenMobileAudioUnlocked,
} from "./mobileAudioUnlock";

function isProbablyMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return true;
  return navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || "");
}

function pickKoreanVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.toLowerCase().startsWith("ko")) ||
    voices.find((v) => /korean|한국/i.test(v.name)) ||
    null
  );
}

/** 성공하면 true. play()가 막히면 false (TTS 폴백용) */
function playClip(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const audio = getSharedGameAudio();
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      resolve(ok);
    };
    const onEnded = () => done(true);
    const onError = () => done(false);
    const timeout = window.setTimeout(() => done(true), 8000);

    audio.pause();
    audio.muted = false;
    audio.volume = 1;
    audio.src = src;
    audio.load();
    audio.addEventListener("ended", onEnded, { once: true });
    audio.addEventListener("error", onError, { once: true });
    void audio
      .play()
      .then(() => {
        /* ended에서 마무리 */
      })
      .catch(() => {
        window.clearTimeout(timeout);
        done(false);
      });
  });
}

function speakWithTts(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }

    const synth = window.speechSynthesis;
    synth.resume();

    const timeoutMs = Math.min(12_000, Math.max(3_500, text.length * 180));
    const timeout = window.setTimeout(() => resolve(), timeoutMs);

    const speakNow = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ko-KR";
      utterance.rate = 0.95;
      utterance.volume = 1;
      const voice = pickKoreanVoice();
      if (voice) utterance.voice = voice;

      utterance.onend = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      utterance.onerror = () => {
        window.clearTimeout(timeout);
        resolve();
      };

      const start = () => synth.speak(utterance);
      if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        window.setTimeout(start, 80);
      } else {
        try {
          synth.cancel();
        } catch {
          /* ignore */
        }
        start();
      }
    };

    if (synth.getVoices().length === 0) {
      const onVoices = () => {
        synth.removeEventListener("voiceschanged", onVoices);
        speakNow();
      };
      synth.addEventListener("voiceschanged", onVoices);
      window.setTimeout(() => {
        synth.removeEventListener("voiceschanged", onVoices);
        speakNow();
      }, 400);
      return;
    }
    speakNow();
  });
}

type PendingSpeak = {
  text: string;
  clipSrc?: string;
  resolve: () => void;
};

let pending: PendingSpeak | null = null;
let waitingForUnlock = false;

async function runSpeak(text: string, clipSrc?: string): Promise<void> {
  if (!isMobileAudioUnlocked()) {
    await unlockMobileAudio();
  }
  if (clipSrc) {
    const played = await playClip(clipSrc);
    if (played) return;
  }
  await speakWithTts(text);
}

/**
 * 안내 음성. 준비된 MP3가 있으면 그걸 재생하고, 막히면 TTS.
 * 스마트폰은 화면을 한 번 탭한 뒤에야 재생된다.
 */
export function speakKorean(text: string, clipSrc?: string): Promise<void> {
  if (typeof window === "undefined" || !text.trim()) {
    return Promise.resolve();
  }

  if (isMobileAudioUnlocked() || !isProbablyMobile()) {
    return runSpeak(text, clipSrc);
  }

  return new Promise((resolve) => {
    pending?.resolve();
    pending = { text, clipSrc, resolve };
    if (waitingForUnlock) return;
    waitingForUnlock = true;
    whenMobileAudioUnlocked(() => {
      waitingForUnlock = false;
      const job = pending;
      pending = null;
      if (!job) return;
      void runSpeak(job.text, job.clipSrc).then(job.resolve);
    });
  });
}
