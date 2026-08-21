/** 로그아웃 직후 — 자동 로그인 bootstrap 건너뛰기 (UserApp 전용) */
export const POST_LOGOUT_SESSION_KEY = "ppamong_post_logout";

/** 설치 후 인트로 1회 표시용 — 로그아웃해도 유지 */
export const INTRO_SEEN_STORAGE_KEY = "ppamong_intro_seen";

export const USER_LOGIN_PATH = "/login";

export const USER_AUTH_PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/social-onboarding",
] as const;

export function isUserAuthPublicPath(pathname?: string): boolean {
  const base = (pathname ?? (typeof window !== "undefined" ? window.location.pathname : "")).split(
    "?",
  )[0];
  return (USER_AUTH_PUBLIC_PATHS as readonly string[]).includes(base);
}

const SIGNUP_LOGIN_PREFILL_KEY = "ppamong_signup_login_prefill";

export function stashSignupLoginPrefill(username: string, password: string): void {
  try {
    sessionStorage.setItem(
      SIGNUP_LOGIN_PREFILL_KEY,
      JSON.stringify({ username, password }),
    );
  } catch {
    /* ignore */
  }
}

export function consumeSignupLoginPrefill(): { username: string; password: string } | null {
  try {
    const raw = sessionStorage.getItem(SIGNUP_LOGIN_PREFILL_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(SIGNUP_LOGIN_PREFILL_KEY);
    const parsed = JSON.parse(raw) as { username?: string; password?: string };
    if (!parsed.username || !parsed.password) return null;
    return { username: parsed.username, password: parsed.password };
  } catch {
    return null;
  }
}

export function markPostLogout(): void {
  try {
    sessionStorage.setItem(POST_LOGOUT_SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function consumePostLogout(): boolean {
  try {
    if (sessionStorage.getItem(POST_LOGOUT_SESSION_KEY) === "1") {
      sessionStorage.removeItem(POST_LOGOUT_SESSION_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function hasSeenIntro(): boolean {
  try {
    return localStorage.getItem(INTRO_SEEN_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markIntroSeen(): void {
  try {
    localStorage.setItem(INTRO_SEEN_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function shouldSkipLoginBootstrap(): boolean {
  return consumePostLogout();
}

/** useState 초기값용 — session 플래그는 소비하지 않음 */
export function peekSkipLoginBootstrap(): boolean {
  try {
    return sessionStorage.getItem(POST_LOGOUT_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}
