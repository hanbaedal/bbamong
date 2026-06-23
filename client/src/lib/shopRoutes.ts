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
    shop: "/home/shop",
    category: (id) => `/home/goods/${id}`,
    product: (id) => `/home/goods/item/${id}`,
  };
}

export function isPublicSitePath(path: string): boolean {
  return path === "/" || path === "/shop" || path.startsWith("/shop/");
}
