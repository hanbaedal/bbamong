import { QueryClient, QueryFunction } from "@tanstack/react-query";

// URL을 절대 경로로 변환하는 헬퍼 함수 (export하여 다른 파일에서도 사용 가능)
export function getFullUrl(path: string): string {
  return path;
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch(getFullUrl("/api/admin/refresh"), {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        return true;
      }
      
      window.dispatchEvent(new CustomEvent("admin-session-expired"));
      return false;
    } catch (error) {
      window.dispatchEvent(new CustomEvent("admin-session-expired"));
      return false;
    } finally {
      isRefreshing = false;
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

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  let res = await fetch(getFullUrl(url), {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (res.status === 401 && !url.includes("/api/admin/login") && !url.includes("/api/admin/refresh")) {
    const refreshed = await refreshAccessToken();
    
    if (refreshed) {
      res = await fetch(getFullUrl(url), {
        method,
        headers: data ? { "Content-Type": "application/json" } : {},
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });
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
    let res = await fetch(getFullUrl(queryKey.join("/") as string), {
      credentials: "include",
    });

    // 401 응답 시 자동 refresh 시도
    if (res.status === 401) {
      const refreshed = await refreshAccessToken();
      
      if (refreshed) {
        // refresh 성공 시 원래 요청 재시도
        res = await fetch(getFullUrl(queryKey.join("/") as string), {
          credentials: "include",
        });
      } else if (unauthorizedBehavior === "returnNull") {
        return null;
      }
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const adminQueryClient = new QueryClient({
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

export { adminQueryClient as queryClient };

export async function adminFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  let bodyForRetry: BodyInit | undefined;
  
  if (options?.body) {
    if (typeof options.body === "string") {
      bodyForRetry = options.body;
    } else if (options.body instanceof ArrayBuffer) {
      bodyForRetry = options.body.slice(0);
    } else if (options.body instanceof URLSearchParams) {
      bodyForRetry = new URLSearchParams(options.body.toString());
    } else {
      console.warn("adminFetch: Non-retryable body type detected. Retry may fail for POST/PUT requests.");
      bodyForRetry = options.body;
    }
  }
  
  let res = await fetch(getFullUrl(url), {
    ...options,
    credentials: "include",
  });

  if (res.status === 401 && !url.includes("/api/admin/login") && !url.includes("/api/admin/refresh")) {
    const refreshed = await refreshAccessToken();
    
    if (refreshed) {
      res = await fetch(getFullUrl(url), {
        ...options,
        body: bodyForRetry,
        credentials: "include",
      });
    } else {
      window.location.href = "/admin/login";
    }
  }

  return res;
}
