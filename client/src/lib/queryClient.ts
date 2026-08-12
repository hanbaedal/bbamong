import { QueryClient, QueryFunction } from "@tanstack/react-query";
import {
  clearTokens,
  getAccessToken,
  getAccessTokenRemainingMs,
  getRefreshToken,
  hydrateAccessToken,
  saveRefreshToken,
  setAccessToken,
} from "./tokenManager";
import {
  isGameSessionProtected,
  notifyUserDuplicateLoginSafe,
  notifyUserSessionExpiredSafe,
} from "./sessionGuard";
import { Capacitor } from "@capacitor/core";

const SESSION_REPLACED_CODE = "SESSION_REPLACED";

async function readSessionReplaced(res: Response): Promise<boolean> {
  try {
    const payload = (await res.clone().json()) as { code?: string } | null;
    return payload?.code === SESSION_REPLACED_CODE;
  } catch {
    return false;
  }
}

function notifyAuthFailure(sessionReplaced: boolean): void {
  if (sessionReplaced) {
    notifyUserDuplicateLoginSafe();
  } else {
    notifyUserSessionExpiredSafe();
  }
}

// API Base URL - 모바일 앱용 (실제 도메인)
const PRODUCTION_API_URL = 'https://ppamong.com';

// 환경에 따른 API Base URL 반환
function getApiBaseUrl(): string {
  // 네이티브 앱(Capacitor)에서는 항상 프로덕션 URL 사용
  if (Capacitor.isNativePlatform()) {
    return PRODUCTION_API_URL;
  }
  // 웹 브라우저에서는 상대 경로 사용 (현재 호스트 기준)
  return '';
}

// URL을 절대 경로로 변환하는 헬퍼 함수 (export하여 다른 파일에서도 사용 가능)
export function getFullUrl(path: string): string {
  return getApiBaseUrl() + path;
}

// Bearer Token 헤더 추가 헬퍼 함수
function getAuthHeaders(): Record<string, string> {
  const token = getAccessToken();
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
    };
  }
  return {};
}

function extractErrorMessage(text: string): string {
  try {
    const json = JSON.parse(text);
    if (json && typeof json.error === "string") {
      return json.error;
    }
    if (json && typeof json.message === "string") {
      return json.message;
    }
  } catch {}
  return text;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(extractErrorMessage(text));
  }
}

let refreshPromise: Promise<boolean> | null = null;
let refreshFailedAt: number = 0;
const REFRESH_COOLDOWN_MS = 5000;
const REFRESH_TIMEOUT_MS = 15_000;

export function resetRefreshCooldown(): void {
  refreshFailedAt = 0;
  refreshPromise = null;
}

function isRefreshAuthFailure(status: number): boolean {
  return status === 401 || status === 403;
}

async function refreshUserAccessToken(): Promise<boolean> {
  if (refreshFailedAt && Date.now() - refreshFailedAt < REFRESH_COOLDOWN_MS) {
    return false;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken = await getRefreshToken();

      if (!refreshToken) {
        console.log("[Token] No refresh token found");
        refreshFailedAt = Date.now();
        // access 가 아직 유효하면 지우지 않음 (게임 keepAlive·embed access-only 등)
        const access = getAccessToken() ?? (await hydrateAccessToken());
        const remainingMs = access ? getAccessTokenRemainingMs(access) : null;
        const accessStillValid = remainingMs != null && remainingMs > 0;
        if (!accessStillValid && !isGameSessionProtected()) {
          await clearTokens();
        }
        return false;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);

      let res: Response;
      try {
        res = await fetch(getFullUrl("/api/users/refresh"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        if (isRefreshAuthFailure(res.status)) {
          const sessionReplaced = await readSessionReplaced(res);
          console.log(
            sessionReplaced
              ? "[Token] Refresh rejected — session replaced by another device"
              : "[Token] Refresh token rejected (auth)",
          );
          refreshFailedAt = Date.now();
          if (!isGameSessionProtected()) {
            await clearTokens();
          }
          notifyAuthFailure(sessionReplaced);
        } else {
          console.log(`[Token] Refresh failed (${res.status}) — keeping tokens for retry`);
        }
        return false;
      }

      const data = await res.json();

      setAccessToken(data.accessToken);
      await saveRefreshToken(data.refreshToken);
      refreshFailedAt = 0;

      return true;
    } catch (error) {
      console.error("[Token] Token refresh network error — keeping tokens:", error);
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/** 게임 중 세션 유지 — access token 만료 임박(5분 이내)일 때만 refresh */
const KEEPALIVE_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

export async function keepAliveUserSession(): Promise<boolean> {
  let token = getAccessToken();
  if (!token) {
    token = await hydrateAccessToken();
  }
  if (!token) {
    return refreshUserAccessToken();
  }

  const remainingMs = getAccessTokenRemainingMs(token);
  if (remainingMs != null && remainingMs > KEEPALIVE_REFRESH_THRESHOLD_MS) {
    return true;
  }

  const refreshed = await refreshUserAccessToken();
  if (refreshed) return true;

  // refresh 실패해도 access 가 남아 있으면 게임 세션 유지
  const still = getAccessToken();
  const stillMs = still ? getAccessTokenRemainingMs(still) : null;
  return stillMs != null && stillMs > 0;
}

/** WS/API 직전 — 만료 임박(2분)이면 refresh. forceRefresh 시 즉시 갱신 시도 */
const ACCESS_TOKEN_REFRESH_AHEAD_MS = 2 * 60 * 1000;

export async function getOrRefreshAccessToken(options?: {
  forceRefresh?: boolean;
}): Promise<string | null> {
  if (options?.forceRefresh) {
    resetRefreshCooldown();
    const refreshed = await refreshUserAccessToken();
    if (refreshed) return getAccessToken();
    // 갱신 실패해도 아직 유효한 access 가 있으면 사용 (게임 보호 구간)
    const fallback = getAccessToken() ?? (await hydrateAccessToken());
    const remainingMs = fallback ? getAccessTokenRemainingMs(fallback) : null;
    return remainingMs != null && remainingMs > 0 ? fallback : null;
  }

  let token = getAccessToken();

  if (!token) {
    token = await hydrateAccessToken();
  }

  if (token) {
    const remainingMs = getAccessTokenRemainingMs(token);
    if (remainingMs == null || remainingMs > ACCESS_TOKEN_REFRESH_AHEAD_MS) {
      return token;
    }
    const refreshed = await refreshUserAccessToken();
    if (refreshed) return getAccessToken();
    return remainingMs > 0 ? token : null;
  }

  const refreshed = await refreshUserAccessToken();
  if (refreshed) {
    return getAccessToken();
  }
  return null;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const makeRequest = async () => {
    return fetch(getFullUrl(url), {
      method,
      headers: {
        ...getAuthHeaders(),
        ...(data ? { "Content-Type": "application/json" } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  };

  let res = await makeRequest();

  if (res.status === 429) {
    console.log("[API] 요청 제한 (429) - 무시");
    return res;
  }

  // 401 에러 시 토큰 재발급 시도 (다른 기기 로그인으로 교체된 경우 재발급 생략)
  if (res.status === 401) {
    const sessionReplaced = await readSessionReplaced(res);
    if (sessionReplaced) {
      if (!isGameSessionProtected()) {
        await clearTokens();
      }
      notifyAuthFailure(true);
      if (isGameSessionProtected()) {
        throw new Error("일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
      }
      throw new Error("다른 기기에서 로그인하여 현재 세션이 종료되었습니다.");
    }

    const refreshed = await refreshUserAccessToken();
    if (refreshed) {
      // 재발급 성공 시 원래 요청 재시도
      res = await makeRequest();
    } else {
      if (isGameSessionProtected()) {
        throw new Error("일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
      }
      throw new Error("세션이 만료되었습니다. 다시 로그인해주세요.");
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const makeRequest = async () => {
      return fetch(getFullUrl(queryKey.join("/") as string), {
        headers: getAuthHeaders(),
      });
    };

    let res = await makeRequest();

    if (res.status === 429) {
      // null 을 캐시에 쓰면 matchesData.some 크래시·가짜 no_match(검은 화면) 유발
      console.log("[Query] 요청 제한 (429) - 기존 캐시 유지");
      throw new Error("RATE_LIMITED");
    }

    // 401 에러 시 토큰 재발급 시도 (다른 기기 로그인으로 교체된 경우 재발급 생략)
    if (res.status === 401) {
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }

      const sessionReplaced = await readSessionReplaced(res);
      if (sessionReplaced) {
        if (!isGameSessionProtected()) {
          await clearTokens();
        }
        notifyAuthFailure(true);
        // null 캐시 덮어쓰기 금지 — 기존 경기 목록 유지 (검은 화면·.some 크래시 방지)
        console.log("[Query] Session replaced by another device — keeping previous query data");
        throw new Error("다른 기기에서 로그인하여 현재 세션이 종료되었습니다.");
      }

      const refreshed = await refreshUserAccessToken();
      if (refreshed) {
        // 재발급 성공 시 원래 요청 재시도
        res = await makeRequest();
      } else {
        console.log("[Query] Session expired — keeping previous query data");
        throw new Error(
          isGameSessionProtected()
            ? "일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해주세요."
            : "세션이 만료되었습니다. 다시 로그인해주세요.",
        );
      }
    }

    if (!res.ok) {
      const text = (await res.text()) || res.statusText;
      throw new Error(extractErrorMessage(text));
    }
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
