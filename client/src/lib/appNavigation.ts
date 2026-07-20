import { getFullUrl, getOrRefreshAccessToken } from "./queryClient";
import { MALL_BASE_PATH } from "@shared/mallConfig";
import {
  getPostLoginPath,
  isMallPath,
  isMemberOnlyLoginIntent,
  DEFAULT_POST_LOGIN_FALLBACK,
} from "./shopRoutes";

export {
  isGuestLoginAllowed,
  buildUserLoginUrl,
  isMemberShopPath,
  DEFAULT_POST_LOGIN_FALLBACK,
  getMallUrl,
} from "./shopRoutes";

export const GAME_PATH = "/prediction";

export type MemberSessionKind = "none" | "guest" | "member";

export function isHomepageShopPath(path: string): boolean {
  const base = path.split("?")[0];
  return base === MALL_BASE_PATH || base.startsWith(`${MALL_BASE_PATH}/`);
}

export async function fetchMemberSessionKind(): Promise<MemberSessionKind> {
  try {
    const token = await getOrRefreshAccessToken();
    if (!token) return "none";

    const res = await fetch(getFullUrl("/api/users/me"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return "none";

    const data = await res.json();
    if (!data.user) return "none";
    if (data.user.provider === "guest") return "guest";
    return "member";
  } catch {
    return "none";
  }
}

/** 게임 ↔ 쇼핑몰: 회원·게스트 모두 /shop */
export async function resolveMallUrl(): Promise<string> {
  return MALL_BASE_PATH;
}

/** @deprecated */
export async function resolveHomepageUrl(): Promise<string> {
  return resolveMallUrl();
}

export function navigateToMall(): void {
  window.location.assign(MALL_BASE_PATH);
}

/** @deprecated */
export function navigateToHomepage(): void {
  navigateToMall();
}

export function navigateToGame(): void {
  window.location.assign(GAME_PATH);
}

export function mapPublicReturnToMemberPath(path: string): string {
  return path;
}

export async function resolveAfterLoginPath(
  fallback = DEFAULT_POST_LOGIN_FALLBACK,
): Promise<string> {
  const raw = getPostLoginPath(fallback);
  const base = raw.split("?")[0];

  if (isMallPath(base)) {
    if (isMemberOnlyLoginIntent()) {
      return raw;
    }
    const kind = await fetchMemberSessionKind();
    if (kind === "member") {
      return raw;
    }
    return raw;
  }

  const kind = await fetchMemberSessionKind();
  if (kind === "guest" && raw === fallback) {
    return GAME_PATH;
  }

  return raw;
}

export function shouldUseHardNavigation(target: string): boolean {
  const targetBase = target.split("?")[0];
  const currentBase = window.location.pathname;

  const targetIsMall = isMallPath(targetBase);
  const currentIsMall = isMallPath(currentBase);

  if (targetIsMall !== currentIsMall) {
    return true;
  }
  if (target.includes("?")) {
    return true;
  }
  return false;
}

/** @deprecated */
export function needsAppSwitchNavigation(target: string): boolean {
  return shouldUseHardNavigation(target);
}

type ClientNavigateFn = (to: string, options?: { replace?: boolean }) => void;

export async function completeLoginNavigation(
  navigate: ClientNavigateFn,
  fallback = DEFAULT_POST_LOGIN_FALLBACK,
): Promise<void> {
  const target = await resolveAfterLoginPath(fallback);

  if (shouldUseHardNavigation(target)) {
    window.location.assign(target);
    return;
  }

  navigate(target, { replace: true });
}

export async function navigateAfterLogin(
  fallback = DEFAULT_POST_LOGIN_FALLBACK,
): Promise<void> {
  const target = await resolveAfterLoginPath(fallback);
  window.location.assign(target);
}

/** 사용자 앱 → 쇼핑몰 (동일 도메인, 토큰 공유) */
export function openMallFromApp(): void {
  window.location.assign(MALL_BASE_PATH);
}
