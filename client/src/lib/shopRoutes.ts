import { MALL_BASE_PATH } from "@shared/mallConfig";

export type SiteMode = "user" | "mall" | "admin";

/** return URL 없을 때 로그인 후 기본 경로 (홈) */
export const DEFAULT_POST_LOGIN_FALLBACK = "/home";

export interface ShopRoutes {
  home: string;
  shop: string;
  category: (id: number) => string;
  product: (id: number) => string;
}

export function getShopRoutes(mode: SiteMode): ShopRoutes {
  if (mode === "mall" || mode === "admin") {
    return {
      home: MALL_BASE_PATH,
      shop: MALL_BASE_PATH,
      category: (id) => `${MALL_BASE_PATH}/category/${id}`,
      product: (id) => `${MALL_BASE_PATH}/product/${id}`,
    };
  }

  return {
    home: MALL_BASE_PATH,
    shop: MALL_BASE_PATH,
    category: (id) => `${MALL_BASE_PATH}/category/${id}`,
    product: (id) => `${MALL_BASE_PATH}/product/${id}`,
  };
}

/** @deprecated MallApp 사용 — 하위 호환 */
export function isPublicSitePath(path: string): boolean {
  const base = path.split("?")[0];
  return base === MALL_BASE_PATH || base.startsWith(`${MALL_BASE_PATH}/`);
}

export function isMallPath(path: string): boolean {
  return isPublicSitePath(path);
}

/**
 * 회원 전용 로그인 의도.
 * `guest=0` 만으로는 숨기지 않는다 — 앱 기본 URL(`/login?guest=0`)에서도 게스트 로그인을 보여야 한다.
 * 쇼핑몰·친구방처럼 return 이 있는 회원 전용 진입만 해당한다.
 */
export function isMemberOnlyLoginIntent(search = window.location.search): boolean {
  const params = new URLSearchParams(search);
  if (params.get("guest") !== "0") return false;
  return Boolean(params.get("return"));
}

/** @deprecated 보물창고 제거 */
export function isMemberShopPath(path: string): boolean {
  return false;
}

export function clearGuestSessionArtifacts(): void {
  localStorage.removeItem("guest_user_id");
}

export function isGuestLoginAllowed(search = window.location.search): boolean {
  const params = new URLSearchParams(search);
  const returnPath = params.get("return");
  if (returnPath) {
    const base = returnPath.split("?")[0];
    if (isMallPath(base)) return false;
    // 친구방 등 — guest=0 + return 이면 정회원 로그인만
    if (params.get("guest") === "0") return false;
  }
  return true;
}

export function buildUserLoginUrl(returnPath: string, options?: { allowGuest?: boolean }): string {
  const params = new URLSearchParams();
  params.set("return", returnPath);
  if (options?.allowGuest === false) {
    params.set("guest", "0");
  }
  return `/login?${params.toString()}`;
}

export function getPostLoginPath(fallback = DEFAULT_POST_LOGIN_FALLBACK): string {
  const params = new URLSearchParams(window.location.search);
  const returnPath = params.get("return");
  if (returnPath?.startsWith("/") && !returnPath.startsWith("//")) {
    try {
      return decodeURIComponent(returnPath);
    } catch {
      return returnPath;
    }
  }
  return fallback;
}

export function shopGridPath(_mode: SiteMode): string {
  return MALL_BASE_PATH;
}

export function getMallUrl(path = MALL_BASE_PATH): string {
  if (typeof window !== "undefined" && window.location.hostname.startsWith("shop.")) {
    return path.replace(MALL_BASE_PATH, "") || "/";
  }
  return path;
}
