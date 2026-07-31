/** 사이드벳 적중 축하 빵빠레 */
const FANFARE_SRC = "/audio/side-bet-fanfare.wav";

let activeAudio: HTMLAudioElement | null = null;

export function stopSideBetFanfare(): void {
  if (!activeAudio) return;
  activeAudio.pause();
  activeAudio.removeAttribute("src");
  activeAudio.load();
  activeAudio = null;
}

export async function playSideBetFanfare(volume = 0.55): Promise<void> {
  stopSideBetFanfare();
  try {
    const audio = new Audio(FANFARE_SRC);
    audio.volume = Math.max(0, Math.min(1, volume));
    activeAudio = audio;
    await audio.play();
  } catch {
    // 자동재생 차단 시 무음
  }
}
