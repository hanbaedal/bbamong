/** 스마트폰 자동재생 차단을 풀기 위한 무음 클립 */
const SILENT_AUDIO_SRC = "/audio/silent.mp3";

let unlocked = false;
let unlockPromise: Promise<void> | null = null;
let sharedAudio: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;
const afterUnlock: Array<() => void> = [];

export function isMobileAudioUnlocked(): boolean {
  return unlocked;
}

export function getSharedGameAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = "auto";
  }
  return sharedAudio;
}

function notifyUnlocked(): void {
  unlocked = true;
  const queued = afterUnlock.splice(0);
  for (const fn of queued) fn();
}

export function whenMobileAudioUnlocked(fn: () => void): void {
  if (unlocked) {
    fn();
    return;
  }
  afterUnlock.push(fn);
}

/** 첫 탭/키 입력에서 AudioContext·TTS·HTMLAudio 잠금을 해제 */
export async function unlockMobileAudio(): Promise<void> {
  if (typeof window === "undefined") return;
  if (unlocked) return;
  if (unlockPromise) return unlockPromise;

  unlockPromise = (async () => {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        if (!audioCtx) audioCtx = new Ctx();
        if (audioCtx.state === "suspended") {
          await audioCtx.resume().catch(() => undefined);
        }
        const buffer = audioCtx.createBuffer(1, 1, 22050);
        const src = audioCtx.createBufferSource();
        src.buffer = buffer;
        src.connect(audioCtx.destination);
        src.start(0);
      }
    } catch {
      /* ignore */
    }

    const audio = getSharedGameAudio();
    try {
      audio.muted = true;
      audio.volume = 0;
      audio.src = SILENT_AUDIO_SRC;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
    } catch {
      /* 제스처 전에는 실패할 수 있음 */
    }
    audio.muted = false;
    audio.volume = 1;

    try {
      const synth = window.speechSynthesis;
      if (synth) {
        synth.resume();
        const warm = new SpeechSynthesisUtterance(" ");
        warm.lang = "ko-KR";
        warm.volume = 0;
        synth.speak(warm);
      }
    } catch {
      /* ignore */
    }

    notifyUnlocked();
  })();

  try {
    await unlockPromise;
  } finally {
    unlockPromise = null;
  }
}

/** 백그라운드(전화·SNS)에서 돌아온 뒤 이미 해제된 AudioContext·TTS를 재개 */
export async function resumeMobileAudio(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!unlocked) return;

  try {
    if (audioCtx?.state === "suspended") {
      await audioCtx.resume().catch(() => undefined);
    }
  } catch {
    /* ignore */
  }

  const audio = getSharedGameAudio();
  try {
    audio.muted = true;
    audio.volume = 0;
    audio.src = SILENT_AUDIO_SRC;
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
  } catch {
    /* 제스처 없이는 실패할 수 있음 */
  }
  audio.muted = false;
  audio.volume = 1;

  try {
    window.speechSynthesis?.resume();
  } catch {
    /* ignore */
  }
}

/** 문서 첫 제스처에서 한 번만 잠금 해제 */
export function installAudioUnlockListeners(): () => void {
  if (typeof document === "undefined") return () => undefined;

  const onGesture = () => {
    void unlockMobileAudio().then(() => {
      document.removeEventListener("pointerdown", onGesture, true);
      document.removeEventListener("touchend", onGesture, true);
      document.removeEventListener("click", onGesture, true);
      document.removeEventListener("keydown", onGesture, true);
    });
  };

  document.addEventListener("pointerdown", onGesture, { capture: true, passive: true });
  document.addEventListener("touchend", onGesture, { capture: true, passive: true });
  document.addEventListener("click", onGesture, { capture: true, passive: true });
  document.addEventListener("keydown", onGesture, { capture: true });

  return () => {
    document.removeEventListener("pointerdown", onGesture, true);
    document.removeEventListener("touchend", onGesture, true);
    document.removeEventListener("click", onGesture, true);
    document.removeEventListener("keydown", onGesture, true);
  };
}
