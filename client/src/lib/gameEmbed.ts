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
  REQUEST_AUTH: "game-embed-request-auth",
  AUTH: "game-embed-auth",
} as const;

type GameEmbedMessage = {
  type: (typeof GAME_EMBED_MESSAGE)[keyof typeof GAME_EMBED_MESSAGE];
  accessToken?: string;
};

export function isGameEmbedMessage(data: unknown): data is GameEmbedMessage {
  if (!data || typeof data !== "object") return false;
  const type = (data as GameEmbedMessage).type;
  return (
    type === GAME_EMBED_MESSAGE.CLOSE ||
    type === GAME_EMBED_MESSAGE.BACK ||
    type === GAME_EMBED_MESSAGE.REQUEST_AUTH ||
    type === GAME_EMBED_MESSAGE.AUTH
  );
}

export function isGameEmbedAuthRequestMessage(
  data: unknown,
): data is { type: typeof GAME_EMBED_MESSAGE.REQUEST_AUTH } {
  return !!data && typeof data === "object" && (data as GameEmbedMessage).type === GAME_EMBED_MESSAGE.REQUEST_AUTH;
}

/** embed iframe → 부모 창에 access token 요청 */
export function requestEmbedAccessToken(timeoutMs = 3000): Promise<string | null> {
  if (!isGameEmbedMode() || window.parent === window) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (
        !data ||
        typeof data !== "object" ||
        (data as GameEmbedMessage).type !== GAME_EMBED_MESSAGE.AUTH
      ) {
        return;
      }
      const token = (data as GameEmbedMessage).accessToken;
      cleanup();
      resolve(typeof token === "string" && token.length > 0 ? token : null);
    };

    const timer = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
    };

    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: GAME_EMBED_MESSAGE.REQUEST_AUTH }, "*");
  });
}

/** embed iframe이 토큰 요청 시 부모에서 호출 */
export function respondToEmbedAuthRequest(event: MessageEvent, accessToken: string | null): void {
  if (!isGameEmbedAuthRequestMessage(event.data)) return;
  if (!accessToken || !event.source || typeof (event.source as Window).postMessage !== "function") {
    return;
  }

  (event.source as Window).postMessage(
    { type: GAME_EMBED_MESSAGE.AUTH, accessToken },
    event.origin || "*",
  );
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

/** embed 모드면 ?embed=1 쿼리 유지 */
export function withEmbedQuery(path: string): string {
  if (!isGameEmbedMode()) return path;
  const qIndex = path.indexOf("?");
  const base = qIndex === -1 ? path : path.slice(0, qIndex);
  const params = new URLSearchParams(qIndex === -1 ? "" : path.slice(qIndex + 1));
  params.set("embed", "1");
  return `${base}?${params.toString()}`;
}

/** embed 모드에서도 iframe 내부 라우팅 유지 */
export function navigateEmbed(path: string, setLocation: (path: string) => void): void {
  setLocation(withEmbedQuery(path));
}

export const HOME_EMBED_NAVIGATE = "home-embed-navigate" as const;

/** embed iframe → 부모 화면으로 경로 이동 요청 (홈 모달 닫기 + navigate) */
export function requestHomeEmbedNavigate(
  path: string,
  setLocation?: (path: string) => void,
): void {
  if (isGameEmbedMode() && window.parent !== window) {
    window.parent.postMessage({ type: HOME_EMBED_NAVIGATE, path }, "*");
    requestGameEmbedClose();
    return;
  }
  setLocation?.(path);
}

export function isHomeEmbedNavigateMessage(
  data: unknown,
): data is { type: typeof HOME_EMBED_NAVIGATE; path: string } {
  if (!data || typeof data !== "object") return false;
  const msg = data as { type?: string; path?: string };
  return msg.type === HOME_EMBED_NAVIGATE && typeof msg.path === "string";
}

/** embed 모드면 부모에 닫기/뒤로 요청, 아니면 fallback 경로로 이동 */
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