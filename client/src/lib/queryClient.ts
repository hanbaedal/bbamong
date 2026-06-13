import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAccessToken, setAccessToken, getRefreshToken, saveRefreshToken, clearTokens } from "./tokenManager";
import { Capacitor } from "@capacitor/core";

// API Base URL - 모바일 앱용 (실제 도메인)
const PRODUCTION_API_URL = 'https://ppadun9.com';

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
let networkFailCount: number = 0;
const REFRESH_COOLDOWN_MS = 30000;
const MAX_NETWORK_FAILURES = 3;

export function resetRefreshCooldown(): void {
  refreshFailedAt = 0;
  networkFailCount = 0;
  refreshPromise = null;
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
        networkFailCount++;
        if (networkFailCount >= MAX_NETWORK_FAILURES) {
          console.log("[Token] No refresh token after repeated attempts, clearing tokens");
          refreshFailedAt = Date.now();
          networkFailCount = 0;
          await clearTokens();
        } else {
          console.log(`[Token] No refresh token (${networkFailCount}/${MAX_NETWORK_FAILURES} - keeping tokens)`);
        }
        return false;
      }

      const res = await fetch(getFullUrl("/api/users/refresh"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });
      
      if (!res.ok) {
        networkFailCount++;
        if (networkFailCount >= MAX_NETWORK_FAILURES) {
          console.log("[Token] Refresh rejected repeatedly, clearing tokens");
          refreshFailedAt = Date.now();
          networkFailCount = 0;
          await clearTokens();
        } else {
          console.log(`[Token] Refresh token rejected (${networkFailCount}/${MAX_NETWORK_FAILURES} - keeping tokens for retry)`);
        }
        return false;
      }

      const data = await res.json();
      
      setAccessToken(data.accessToken);
      await saveRefreshToken(data.refreshToken);
      refreshFailedAt = 0;
      networkFailCount = 0;
      
      return true;
    } catch (error) {
      networkFailCount++;
      if (networkFailCount >= MAX_NETWORK_FAILURES) {
        console.error("[Token] Token refresh failed repeatedly, clearing tokens:", error);
        refreshFailedAt = Date.now();
        networkFailCount = 0;
        await clearTokens();
      } else {
        console.error(`[Token] Token refresh failed (network error ${networkFailCount}/${MAX_NETWORK_FAILURES} - keeping tokens):`, error);
      }
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function getOrRefreshAccessToken(): Promise<string | null> {
  let token = getAccessToken();
  
  if (token) {
    return token;
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

  // 401 에러 시 토큰 재발급 시도
  if (res.status === 401) {
    const refreshed = await refreshUserAccessToken();
    if (refreshed) {
      // 재발급 성공 시 원래 요청 재시도
      res = await makeRequest();
    } else {
      // Refresh 실패 -> 이미 로그인 페이지로 리다이렉트됨
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
      console.log("[Query] 요청 제한 (429) - 무시하고 null 반환");
      return null;
    }

    // 401 에러 시 토큰 재발급 시도
    if (res.status === 401) {
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
      
      const refreshed = await refreshUserAccessToken();
      if (refreshed) {
        // 재발급 성공 시 원래 요청 재시도
        res = await makeRequest();
      } else {
        // Refresh 실패 시 null 반환 (에러 throw 대신)
        // 컴포넌트 언마운트를 방지하고 graceful하게 처리
        console.log("[Query] Session expired, returning null instead of throwing");
        return null;
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
