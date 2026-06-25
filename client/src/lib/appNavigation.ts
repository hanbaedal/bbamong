import { getFullUrl, getOrRefreshAccessToken } from "./queryClient";
import { getPostLoginPath, isPublicSitePath, isMemberShopPath } from "./shopRoutes";

export { isGuestLoginAllowed, buildUserLoginUrl, isMemberShopPath } from "./shopRoutes";

export const GAME_PATH = "/prediction";

export type MemberSessionKind = "none" | "guest" | "member";

export function isHomepageShopPath(path: string): boolean {
  const base = path.split("?")[0];
  return (
    base === "/" ||
    base === "/shop" ||
    base.startsWith("/shop/") ||
    base === "/home" ||
    base === "/home/shop" ||
    base.startsWith("/home/goods/")
  );
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

/** 게임 중 로고: 회원 → 회원 홈페이지, 게스트/비로그인 → 공개 홈페이지 */
export async function resolveHomepageUrl(): Promise<string> {
  const kind = await fetchMemberSessionKind();
  if (kind === "member") return "/home?shop=1";
  return "/";
}

export function navigateToHomepage(): void {
  void resolveHomepageUrl().then((url) => {
    window.location.assign(url);
  });
}

/** 홈페이지 로고: 게임으로 (기존 로그인·게스트 세션 유지) */
export function navigateToGame(): void {
  window.location.assign(GAME_PATH);
}

/** 공개 홈(/)·/shop 경로 → 회원 앱 보물창고 경로 */
export function mapPublicReturnToMemberPath(path: string): string {
  const pathname = path.split("?")[0];
  if (pathname === "/" || pathname === "/shop") return "/home?shop=1";
  const categoryMatch = pathname.match(/^\/shop\/category\/(\d+)$/);
  if (categoryMatch) return `/home/goods/${categoryMatch[1]}`;
  const productMatch = pathname.match(/^\/shop\/product\/(\d+)$/);
  if (productMatch) return `/home/goods/item/${productMatch[1]}`;
  return path;
}

/**
 * 로그인·가입 완료 후 이동 경로 결정.
 * ppamong.com(공개 홈)에서 로그인한 회원은 보물창고(/home?shop=1)로 이동.
 */
export async function resolveAfterLoginPath(fallback = "/home"): Promise<string> {
  const raw = getPostLoginPath(fallback);
  const base = raw.split("?")[0];
  let target = raw;

  if (isPublicSitePath(base)) {
    const kind = await fetchMemberSessionKind();
    if (kind === "member") {
      target = mapPublicReturnToMemberPath(raw);
    }
    return target;
  }

  if (isMemberShopPath(base)) {
    const kind = await fetchMemberSessionKind();
    if (kind !== "member") {
      return "/";
    }
    return target;
  }

  const kind = await fetchMemberSessionKind();
  // 게임 앱에서 return 없이 로그인한 게스트는 예측 화면으로
  if (kind === "guest" && target === fallback) {
    return GAME_PATH;
  }

  return target;
}

/** 공개 홈 ↔ 회원 앱 전환 시에만 전체 페이지 이동 필요 */
export function needsAppSwitchNavigation(target: string): boolean {
  const targetBase = target.split("?")[0];
  const currentBase = window.location.pathname;
  return isPublicSitePath(targetBase) !== isPublicSitePath(currentBase);
}

type ClientNavigateFn = (to: string, options?: { replace?: boolean }) => void;

/**
 * 로그인·가입 완료 후 이동.
 * 같은 앱(게임) 내 경로는 SPA 이동으로 access token 유지.
 */
export async function completeLoginNavigation(
  navigate: ClientNavigateFn,
  fallback = "/home",
): Promise<void> {
  const target = await resolveAfterLoginPath(fallback);

  if (needsAppSwitchNavigation(target)) {
    window.location.assign(target);
    return;
  }

  navigate(target, { replace: true });
}

/** 자동 로그인 등 SPA 라우터 없이 이동할 때 */
export async function navigateAfterLogin(fallback = "/home"): Promise<void> {
  const target = await resolveAfterLoginPath(fallback);
  window.location.assign(target);
}
