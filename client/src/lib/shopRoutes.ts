export type SiteMode = "user" | "public" | "admin";

/** return URL 없을 때 로그인 후 기본 경로 (게임) */
export const DEFAULT_POST_LOGIN_FALLBACK = "/prediction";

export interface ShopRoutes {
  home: string;
  shop: string;
  category: (id: number) => string;
  product: (id: number) => string;
}

export function getShopRoutes(mode: SiteMode): ShopRoutes {
  if (mode === "public") {
    return {
      home: "/",
      shop: "/shop",
      category: (id) => `/shop/category/${id}`,
      product: (id) => `/shop/product/${id}`,
    };
  }

  if (mode === "admin") {
    return {
      home: "/admin/home",
      shop: "/admin/homepage-shop",
      category: (id) => `/home/goods/${id}`,
      product: (id) => `/home/goods/item/${id}`,
    };
  }

  return {
    home: "/home",
    shop: "/home",
    category: (id) => `/home/goods/${id}`,
    product: (id) => `/home/goods/item/${id}`,
  };
}

export function isPublicSitePath(path: string): boolean {
  return path === "/" || path === "/shop" || path.startsWith("/shop/");
}

/** 공개 홈 소개(/)에서 잘못 연결된 회원 로그인 return — 관리자 로그인으로 보냄 */
export function isIntroStaffLoginReturn(returnPath: string | null | undefined): boolean {
  if (!returnPath) return false;
  let decoded = returnPath;
  try {
    decoded = decodeURIComponent(returnPath);
  } catch {
    // keep raw
  }
  const base = decoded.split("?")[0];
  return base === "/";
}

/** 회원 전용 보물창고 경로 (게스트 접근 불가) */
export function isMemberShopPath(path: string): boolean {
  const base = path.split("?")[0];
  return (
    base === "/home" ||
    base === "/home/shop" ||
    base.startsWith("/home/goods/") ||
    base === "/home/game-guide"
  );
}

/** 홈페이지(공개)에서 온 로그인인지 — 게스트 로그인 비허용 */
export function isGuestLoginAllowed(search = window.location.search): boolean {
  const params = new URLSearchParams(search);
  if (params.get("guest") === "0") return false;
  const returnPath = params.get("return");
  if (returnPath) {
    const base = returnPath.split("?")[0];
    if (isPublicSitePath(base)) return false;
    if (isMemberShopPath(base)) return false;
    return true;
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

export function shopGridPath(mode: SiteMode): string {
  const routes = getShopRoutes(mode);
  if (mode === "public") return routes.shop;
  return `${routes.shop}?shop=1`;
}
