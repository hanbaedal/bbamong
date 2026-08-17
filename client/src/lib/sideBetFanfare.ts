import { getSharedGameAudio, unlockMobileAudio } from "./mobileAudioUnlock";

/** 사이드벳 적중 축하 빵빠레 */
const FANFARE_SRC = "/audio/side-bet-fanfare.wav";

export function stopSideBetFanfare(): void {
  const audio = getSharedGameAudio();
  audio.pause();
}

export async function playSideBetFanfare(volume = 0.55): Promise<void> {
  await unlockMobileAudio();
  try {
    const audio = getSharedGameAudio();
    audio.pause();
    audio.muted = false;
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.src = FANFARE_SRC;
    await audio.play();
  } catch {
    // 자동재생 차단 시 무음
  }
}
