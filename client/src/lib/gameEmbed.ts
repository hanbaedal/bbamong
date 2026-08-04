/** 게임 화면 iframe 임베드 — 헤더·푸터 숨김 */
export function isGameEmbedMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("embed") === "1";
}

export function buildGameEmbedUrl(path: string): string {
  const base = path.split("?")[0];
  return `${base}?embed=1`;
}

export const GAME_EMBED_MESSAGE = {
  CLOSE: "game-embed-close",
  BACK: "game-embed-back",
} as const;

type GameEmbedMessage = { type: (typeof GAME_EMBED_MESSAGE)[keyof typeof GAME_EMBED_MESSAGE] };

export function isGameEmbedMessage(data: unknown): data is GameEmbedMessage {
  if (!data || typeof data !== "object") return false;
  const type = (data as GameEmbedMessage).type;
  return type === GAME_EMBED_MESSAGE.CLOSE || type === GAME_EMBED_MESSAGE.BACK;
}

function postToGameParent(type: GameEmbedMessage["type"]): void {
  if (isGameEmbedMode() && window.parent !== window) {
    window.parent.postMessage({ type }, "*");
  }
}

/** embed 모달 전체 닫기 */
export function requestGameEmbedClose(): void {
  postToGameParent(GAME_EMBED_MESSAGE.CLOSE);
}

/** embed 모달 한 단계 뒤로 (서브메뉴 또는 iframe 내 history) */
export function requestGameEmbedBack(): void {
  postToGameParent(GAME_EMBED_MESSAGE.BACK);
}

/** embed이면 부모에 닫기/뒤로 요청, 아니면 fallback 경로로 이동 */
export function navigateBackOrEmbed(
  fallbackPath: string,
  setLocation: (path: string) => void,
): void {
  if (isGameEmbedMode() && window.parent !== window) {
    requestGameEmbedBack();
    return;
  }
  setLocation(fallbackPath);
}
