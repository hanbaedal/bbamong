/** 로그아웃·회원 로그인 화면 — 자동 로그인 bootstrap 건너뛰기 */
export const POST_LOGOUT_SESSION_KEY = "ppamong_post_logout";

export const USER_LOGIN_PATH = "/login?guest=0";

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

export function isMemberLoginIntent(search: string): boolean {
  return new URLSearchParams(search).get("guest") === "0";
}

export function loginSearchFromLocation(location: string): string {
  const idx = location.indexOf("?");
  return idx >= 0 ? location.slice(idx + 1) : "";
}

export function shouldSkipLoginBootstrap(location: string): boolean {
  if (consumePostLogout()) return true;
  return isMemberLoginIntent(loginSearchFromLocation(location));
}

/** useState 초기값용 — session 플래그는 소비하지 않음 */
export function peekSkipLoginBootstrap(location: string): boolean {
  if (isMemberLoginIntent(loginSearchFromLocation(location))) return true;
  try {
    return sessionStorage.getItem(POST_LOGOUT_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}
