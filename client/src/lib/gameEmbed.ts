/** 게임·홈 embed 패널 — iframe URL / 인라인 패널 공통 네비게이션 */
import { getOrRefreshAccessToken } from "@/lib/queryClient";
import {
  isInlinePanelEmbedMode,
  isNestedEmbedPath,
  requestInlinePanelAppNavigate,
  requestInlinePanelBack,
  requestInlinePanelClose,
} from "@/lib/embedPanelController";
import {
  mapBackForLandscapeSplit,
  mapPathForLandscapeSplit,
  resolveLegacyPathToSplit,
} from "@/lib/landscapeSplitRoutes";

export function isIframeEmbedMode(): boolean {
  if (typeof window === "undefined") return false;
  if (isInlinePanelEmbedMode()) return false;
  return (
    new URLSearchParams(window.location.search).get("embed") === "1" &&
    window.parent !== window
  );
}

export function isGameEmbedMode(): boolean {
  return isInlinePanelEmbedMode() || isIframeEmbedMode();
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

/** embed iframe → 부모 창에 access token 요청 (재시도 포함) */
export function requestEmbedAccessToken(
  timeoutMs = 5000,
  retryIntervalMs = 250,
): Promise<string | null> {
  if (!isIframeEmbedMode()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let settled = false;

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
      if (typeof token !== "string" || token.length === 0) return;
      finish(token);
    };

    const finish = (token: string | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      window.clearInterval(retryTimer);
      window.clearTimeout(timeoutTimer);
      resolve(token);
    };

    const requestFromParent = () => {
      window.parent.postMessage({ type: GAME_EMBED_MESSAGE.REQUEST_AUTH }, "*");
    };

    window.addEventListener("message", onMessage);
    requestFromParent();

    const retryTimer = window.setInterval(requestFromParent, retryIntervalMs);
    const timeoutTimer = window.setTimeout(() => finish(null), timeoutMs);
  });
}

export function listenForEmbedAccessToken(onToken: (token: string) => void): () => void {
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
    if (typeof token === "string" && token.length > 0) {
      onToken(token);
    }
  };

  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}

export async function pushEmbedAccessTokenToFrame(
  frame: HTMLIFrameElement | null | undefined,
): Promise<void> {
  const target = frame?.contentWindow;
  if (!target) return;

  const token = await getOrRefreshAccessToken();
  if (!token) return;

  target.postMessage({ type: GAME_EMBED_MESSAGE.AUTH, accessToken: token }, "*");
}

export function respondToEmbedAuthRequest(event: MessageEvent, accessToken: string | null): void {
  if (!isGameEmbedAuthRequestMessage(event.data)) return;
  if (!accessToken || !event.source || typeof (event.source as Window).postMessage !== "function") {
    return;
  }

  (event.source as Window).postMessage(
    { type: GAME_EMBED_MESSAGE.AUTH, accessToken },
    "*",
  );
}

function postToGameParent(type: GameEmbedMessage["type"]): void {
  if (isIframeEmbedMode()) {
    window.parent.postMessage({ type }, "*");
  }
}

export function requestGameEmbedClose(): void {
  if (requestInlinePanelClose()) return;
  postToGameParent(GAME_EMBED_MESSAGE.CLOSE);
}

export function requestGameEmbedBack(): void {
  if (requestInlinePanelBack()) return;
  postToGameParent(GAME_EMBED_MESSAGE.BACK);
}

export function withEmbedQuery(path: string): string {
  if (!isIframeEmbedMode()) return path;
  const qIndex = path.indexOf("?");
  const base = qIndex === -1 ? path : path.slice(0, qIndex);
  const params = new URLSearchParams(qIndex === -1 ? "" : path.slice(qIndex + 1));
  params.set("embed", "1");
  return `${base}?${params.toString()}`;
}

export function navigateEmbed(path: string, setLocation: (path: string) => void): void {
  if (typeof window !== "undefined") {
    const splitPath = mapPathForLandscapeSplit(window.location.pathname, path);
    if (splitPath) {
      setLocation(splitPath);
      return;
    }
  }

  const legacySplit = resolveLegacyPathToSplit(path);
  if (legacySplit) {
    setLocation(legacySplit);
    return;
  }

  if (isInlinePanelEmbedMode()) {
    setLocation(path);
    return;
  }
  setLocation(withEmbedQuery(path));
}

export const HOME_EMBED_NAVIGATE = "home-embed-navigate" as const;

export function requestHomeEmbedNavigate(
  path: string,
  setLocation?: (path: string) => void,
): void {
  if (requestInlinePanelAppNavigate(path)) return;

  if (isIframeEmbedMode()) {
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

export function navigateBackOrEmbed(
  fallbackPath: string,
  setLocation: (path: string) => void,
): void {
  if (requestInlinePanelBack()) return;

  if (typeof window !== "undefined") {
    const splitBack = mapBackForLandscapeSplit(window.location.pathname, fallbackPath);
    if (splitBack) {
      setLocation(splitBack);
      return;
    }
  }

  if (isIframeEmbedMode()) {
    requestGameEmbedBack();
    return;
  }
  setLocation(fallbackPath);
}

export { isNestedEmbedPath };
