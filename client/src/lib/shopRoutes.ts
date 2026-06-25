export type SiteMode = "user" | "public" | "admin";

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

export function getPostLoginPath(fallback = "/home"): string {
  const params = new URLSearchParams(window.location.search);
  const returnPath = params.get("return");
  if (returnPath?.startsWith("/") && !returnPath.startsWith("//")) {
    return returnPath;
  }
  return fallback;
}

export function shopGridPath(mode: SiteMode): string {
  const routes = getShopRoutes(mode);
  if (mode === "public") return routes.shop;
  return `${routes.shop}?shop=1`;
}
