import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { 
  getManagerAccessToken, 
  setManagerAccessToken,
  getManagerRefreshToken, 
  saveManagerRefreshToken, 
  clearManagerTokens 
} from "./managerTokenManager";

const PRODUCTION_API_URL = 'https://ppadun9.com';

function getApiBaseUrl(): string {
  if (Capacitor.isNativePlatform()) {
    return PRODUCTION_API_URL;
  }
  return '';
}

export function getFullUrl(path: string): string {
  return getApiBaseUrl() + path;
}

const isNative = Capacitor.isNativePlatform();

function getAuthHeaders(): HeadersInit {
  if (isNative) {
    const accessToken = getManagerAccessToken();
    if (accessToken) {
      return { 'Authorization': `Bearer ${accessToken}` };
    }
  }
  return {};
}

let refreshPromise: Promise<boolean> | null = null;
let refreshFailedAt: number = 0;
let networkFailCount: number = 0;
const REFRESH_COOLDOWN_MS = 30000;
const MAX_NETWORK_FAILURES = 3;

export function resetManagerRefreshCooldown(): void {
  refreshFailedAt = 0;
  networkFailCount = 0;
  refreshPromise = null;
}

export async function refreshAccessToken(): Promise<boolean> {
  if (refreshFailedAt && Date.now() - refreshFailedAt < REFRESH_COOLDOWN_MS) {
    return false;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken = await getManagerRefreshToken();
      
      if (!refreshToken && isNative) {
        refreshFailedAt = Date.now();
        window.dispatchEvent(new CustomEvent("manager-session-expired"));
        return false;
      }

      const res = await fetch(getFullUrl("/api/manager/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: isNative ? JSON.stringify({ refreshToken }) : undefined,
        credentials: isNative ? "omit" : "include",
      });

      if (res.ok) {
        const data = await res.json();
        if (isNative && data.accessToken && data.refreshToken) {
          setManagerAccessToken(data.accessToken);
          await saveManagerRefreshToken(data.refreshToken);
        }
        refreshFailedAt = 0;
        networkFailCount = 0;
        return true;
      }
      
      refreshFailedAt = Date.now();
      await clearManagerTokens();
      managerQueryClient.clear();
      if (!isNative) {
        fetch(getFullUrl("/api/manager/clear-session"), { method: "POST", credentials: "include" }).catch(() => {});
      }
      window.dispatchEvent(new CustomEvent("manager-session-expired"));
      return false;
    } catch (error) {
      networkFailCount++;
      if (networkFailCount >= MAX_NETWORK_FAILURES) {
        console.error("[ManagerToken] Token refresh failed repeatedly, clearing tokens:", error);
        refreshFailedAt = Date.now();
        networkFailCount = 0;
        await clearManagerTokens();
        managerQueryClient.clear();
        if (!isNative) {
          fetch(getFullUrl("/api/manager/clear-session"), { method: "POST", credentials: "include" }).catch(() => {});
        }
        window.dispatchEvent(new CustomEvent("manager-session-expired"));
      } else {
        console.error(`[ManagerToken] Token refresh failed (network error ${networkFailCount}/${MAX_NETWORK_FAILURES} - keeping tokens):`, error);
      }
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
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

export async function managerApiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: HeadersInit = {
    ...getAuthHeaders(),
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  let res = await fetch(getFullUrl(url), {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: isNative ? "omit" : "include",
  });

  if (res.status === 401 && !url.includes("/api/manager/login") && !url.includes("/api/manager/refresh")) {
    const refreshed = await refreshAccessToken();
    
    if (refreshed) {
      const retryHeaders: HeadersInit = {
        ...getAuthHeaders(),
        ...(data ? { "Content-Type": "application/json" } : {}),
      };
      
      res = await fetch(getFullUrl(url), {
        method,
        headers: retryHeaders,
        body: data ? JSON.stringify(data) : undefined,
        credentials: isNative ? "omit" : "include",
      });
    }
  }

  if (res.status === 403 && !url.includes("/api/manager/login")) {
    try {
      const cloned = res.clone();
      const errorData = await cloned.json();
      if (errorData.deactivated) {
        return res;
      }
      if (errorData.message && errorData.message.includes("승인되지 않은")) {
        await clearManagerTokens();
        window.dispatchEvent(new CustomEvent("manager-session-expired"));
      }
    } catch {}
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
    let res = await fetch(getFullUrl(queryKey.join("/") as string), {
      headers: getAuthHeaders(),
      credentials: isNative ? "omit" : "include",
    });

    if (res.status === 401) {
      const refreshed = await refreshAccessToken();
      
      if (refreshed) {
        res = await fetch(getFullUrl(queryKey.join("/") as string), {
          headers: getAuthHeaders(),
          credentials: isNative ? "omit" : "include",
        });
      } else if (unauthorizedBehavior === "returnNull") {
        return null;
      }
    }

    if (res.status === 403) {
      try {
        const cloned = res.clone();
        const errorData = await cloned.json();
        if (errorData.deactivated) {
          return null;
        }
        if (errorData.message && errorData.message.includes("승인되지 않은")) {
          await clearManagerTokens();
          window.dispatchEvent(new CustomEvent("manager-session-expired"));
          return null;
        }
      } catch {}
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const managerQueryClient = new QueryClient({
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

export async function managerFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const mergedHeaders: HeadersInit = {
    ...getAuthHeaders(),
    ...(options?.headers || {}),
  };

  let res = await fetch(getFullUrl(url), {
    ...options,
    headers: mergedHeaders,
    credentials: isNative ? "omit" : "include",
  });

  if (res.status === 401 && !url.includes("/api/manager/login") && !url.includes("/api/manager/refresh")) {
    const refreshed = await refreshAccessToken();
    
    if (refreshed) {
      const retryHeaders: HeadersInit = {
        ...getAuthHeaders(),
        ...(options?.headers || {}),
      };
      
      res = await fetch(getFullUrl(url), {
        ...options,
        headers: retryHeaders,
        credentials: isNative ? "omit" : "include",
      });
    }
  }

  if (res.status === 403 && !url.includes("/api/manager/login")) {
    try {
      const cloned = res.clone();
      const errorData = await cloned.json();
      if (errorData.deactivated) {
        return res;
      }
      if (errorData.message && errorData.message.includes("승인되지 않은")) {
        await clearManagerTokens();
        window.dispatchEvent(new CustomEvent("manager-session-expired"));
      }
    } catch {}
  }

  return res;
}
