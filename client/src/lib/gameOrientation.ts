/** 게임 화면 진입 시 가로 고정, 이탈 시 해제 (모바일 WebView / 브라우저) */
export async function lockGameLandscape(): Promise<void> {
  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };
    if (typeof orientation?.lock === "function") {
      await orientation.lock("landscape");
    }
  } catch {
    /* 일부 브라우저·데스크톱에서는 거부됨 */
  }
}

export function unlockGameLandscape(): void {
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* ignore */
  }
}
